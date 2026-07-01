import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { DataSource } from 'typeorm';
import { buildApp } from '../../src/app.js';
import { createAppDataSource } from '../../src/config/database.js';

export type Role = 'customer' | 'seller-owner' | 'other-seller' | 'support' | 'moderator' | 'super-admin' | 'suspended' | 'banned';

export interface ProviderExpectation {
  provider: 'stripe' | 'razorpay' | 'square' | 'notification' | 'media';
  operation: string;
  consumed?: boolean;
}

export interface AuthenticatedClient {
  role: Role;
  request: (options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    payload?: unknown;
    headers?: Record<string, string>;
  }) => Promise<LightMyRequestResponse>;
}

export interface IntegrationHarness {
  app: FastifyInstance;
  dataSource: DataSource;
  requestIds: string[];
  providerExpectations: ProviderExpectation[];
  clientFor: (role: Role) => AuthenticatedClient;
  expectProviderCall: (expectation: ProviderExpectation) => void;
  consumeProviderCall: (provider: ProviderExpectation['provider'], operation: string) => void;
  resetDatabase: () => Promise<void>;
  teardown: () => Promise<void>;
}

const SAFE_TEST_DB_PATTERN = /(_test|test_|testing|ci|migration_test)$/i;
const BLOCKED_DB_PATTERN = /(prod|production|staging|development|dev)$/i;

export function assertDisposableDatabaseUrl(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName || BLOCKED_DB_PATTERN.test(dbName) || !SAFE_TEST_DB_PATTERN.test(dbName)) {
    throw new Error(`Refusing to run integration harness against non-disposable database "${dbName}"`);
  }
}

export function deterministicTokenFor(role: Role): string {
  return Buffer.from(JSON.stringify({
    sub: `${role}-user`,
    role,
    tenant_id: role.includes('seller') ? 'business-1' : 'customer-tenant',
    suspended: role === 'suspended',
    banned: role === 'banned',
  })).toString('base64url');
}

export async function createIntegrationHarness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<IntegrationHarness> {
  const databaseUrl = env.MIGRATION_TEST_DATABASE_URL ?? env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('MIGRATION_TEST_DATABASE_URL or DATABASE_URL is required for integration harness');
  }
  assertDisposableDatabaseUrl(databaseUrl);

  const dataSource = createAppDataSource({
    ...env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    DB_MIGRATION_JOB: 'true',
    DB_SYNCHRONIZE_LOCAL: 'false',
  } as NodeJS.ProcessEnv);
  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'all' });
  if (await dataSource.showMigrations()) {
    throw new Error('Integration harness started with pending migrations');
  }

  const requestIds: string[] = [];
  const providerExpectations: ProviderExpectation[] = [];
  const app = await buildApp(
    { orm: dataSource },
    {
      registerRuntimeRoutes: false,
      genReqId: () => {
        const id = `test-request-${requestIds.length + 1}`;
        requestIds.push(id);
        return id;
      },
    },
  );

  const resetDatabase = async () => {
    const rows = await dataSource.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
    `) as Array<{ tablename: string }>;
    for (const row of rows) {
      await dataSource.query(`TRUNCATE TABLE "${row.tablename}" RESTART IDENTITY CASCADE`);
    }
  };

  const clientFor = (role: Role): AuthenticatedClient => ({
    role,
    request: (options) =>
      app.inject({
        method: options.method,
        url: options.url,
        payload: options.payload,
        headers: {
          authorization: `Bearer ${deterministicTokenFor(role)}`,
          'x-test-role': role,
          ...(options.headers ?? {}),
        },
      }),
  });

  const expectProviderCall = (expectation: ProviderExpectation) => {
    providerExpectations.push({ ...expectation, consumed: false });
  };

  const consumeProviderCall = (provider: ProviderExpectation['provider'], operation: string) => {
    const expectation = providerExpectations.find(
      (candidate) => candidate.provider === provider && candidate.operation === operation && !candidate.consumed,
    );
    if (!expectation) {
      throw new Error(`Unexpected provider call ${provider}.${operation}`);
    }
    expectation.consumed = true;
  };

  const teardown = async () => {
    const unconsumed = providerExpectations.filter((expectation) => !expectation.consumed);
    try {
      if (unconsumed.length > 0) {
        throw new Error(`Unconsumed provider expectations: ${unconsumed.map((e) => `${e.provider}.${e.operation}`).join(', ')}`);
      }
    } finally {
      await app.close();
      await dataSource.destroy();
    }
  };

  return {
    app,
    dataSource,
    requestIds,
    providerExpectations,
    clientFor,
    expectProviderCall,
    consumeProviderCall,
    resetDatabase,
    teardown,
  };
}
