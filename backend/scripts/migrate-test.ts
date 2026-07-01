import { Client } from 'pg';
import { assertProductionSafeDatabaseConfig, createAppDataSource } from '../src/config/database.js';

const DEFAULT_TEST_URL = 'postgresql://menumaker:menumaker@localhost:5432/menumaker_migration_test';

function databaseUrl(): string {
  return process.env.MIGRATION_TEST_DATABASE_URL || DEFAULT_TEST_URL;
}

function adminUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = '/postgres';
  return parsed.toString();
}

async function recreateDatabase(url: string): Promise<void> {
  const parsed = new URL(url);
  const databaseName = parsed.pathname.replace(/^\//, '');
  if (!databaseName || !databaseName.includes('test')) {
    throw new Error(`Refusing to recreate non-test database: ${databaseName}`);
  }

  const client = new Client({ connectionString: adminUrl(url) });
  await client.connect();
  try {
    await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]);
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await client.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await client.end();
  }
}

async function runMigrations(url: string): Promise<void> {
  const migrationEnv = {
    ...process.env,
    DATABASE_URL: url,
    NODE_ENV: 'test',
    DB_MIGRATION_JOB: 'true',
    DB_SYNCHRONIZE_LOCAL: undefined,
  } as NodeJS.ProcessEnv;
  assertProductionSafeDatabaseConfig(migrationEnv);
  const dataSource = createAppDataSource(migrationEnv);
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: 'all' });
    const pending = await dataSource.showMigrations();
    if (pending) {
      throw new Error('Pending migrations remain after migration run');
    }
  } finally {
    await dataSource.destroy();
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const url = databaseUrl();
  if (command === 'clean') {
    await recreateDatabase(url);
    await runMigrations(url);
    console.log('✅ clean migration test database reached current schema');
    return;
  }
  if (command === 'upgrade') {
    await runMigrations(url);
    console.log('✅ upgrade migration path has zero pending migrations');
    return;
  }
  throw new Error('usage: tsx scripts/migrate-test.ts clean|upgrade');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
