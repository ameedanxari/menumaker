import type { FastifyPluginAsync } from 'fastify';
import type { DataSource } from 'typeorm';
import { currentTraceContext, recordDomainCounter, withSpan } from '../observability/telemetry.js';

export interface HealthCheckResult {
  name: string;
  status: 'ok' | 'degraded' | 'fail';
  latency_ms: number;
  message?: string;
}

export interface HealthRoutesOptions {
  orm?: Pick<DataSource, 'isInitialized' | 'query' | 'showMigrations'>;
  requiredSecrets?: string[];
  capabilityChecks?: Record<string, () => Promise<boolean> | boolean>;
  outboxBacklog?: () => Promise<number> | number;
  maxOutboxBacklog?: number;
  drainSignal?: () => boolean;
  adminToken?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 750;

export function createHealthRoutes(options: HealthRoutesOptions = {}): FastifyPluginAsync {
  return async function healthRoutes(fastify) {
    fastify.get('/health/live', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
    }));

    fastify.get('/health/ready', async (request, reply) => {
      const report = await readinessReport(options);
      const isReady = report.status === 'ok';
      recordDomainCounter('notification_outbox', { route: '/health/ready', result: report.status });
      reply.code(isReady ? 200 : 503);
      return {
        ...report,
        request_id: request.id,
        trace_id: currentTraceContext()?.traceId,
      };
    });

    fastify.get('/health/diagnostics', async (request, reply) => {
      if (!options.adminToken || request.headers.authorization !== `Bearer ${options.adminToken}`) {
        reply.code(404);
        return { error: { code: 'NOT_FOUND', message: 'not found', request_id: request.id } };
      }
      const report = await readinessReport(options);
      return {
        status: report.status,
        checks: report.checks,
        drain: Boolean(options.drainSignal?.()),
        generated_at: report.timestamp,
      };
    });
  };
}

export async function readinessReport(options: HealthRoutesOptions = {}): Promise<{
  status: 'ok' | 'degraded' | 'fail';
  timestamp: string;
  checks: HealthCheckResult[];
}> {
  const checks: HealthCheckResult[] = [];
  checks.push(await timedCheck('database', options.timeoutMs, async () => {
    if (!options.orm) return { status: 'degraded', message: 'database check not configured' };
    if (!options.orm.isInitialized) return { status: 'fail', message: 'database not initialized' };
    await options.orm.query?.('select 1');
    const hasPendingMigrations = await options.orm.showMigrations?.();
    return hasPendingMigrations
      ? { status: 'fail', message: 'pending migrations' }
      : { status: 'ok' };
  }));

  checks.push(await timedCheck('required_references', options.timeoutMs, async () => {
    const missing = (options.requiredSecrets ?? []).filter((name) => !process.env[name]);
    return missing.length
      ? { status: 'fail', message: `missing required runtime references: ${missing.join(',')}` }
      : { status: 'ok' };
  }));

  for (const [name, check] of Object.entries(options.capabilityChecks ?? {})) {
    checks.push(await timedCheck(`capability:${name}`, options.timeoutMs, async () => {
      const enabled = await check();
      return enabled ? { status: 'ok' } : { status: 'degraded', message: 'capability disabled' };
    }));
  }

  checks.push(await timedCheck('outbox_backlog', options.timeoutMs, async () => {
    const backlog = Number(await options.outboxBacklog?.() ?? 0);
    const max = options.maxOutboxBacklog ?? 500;
    return backlog > max
      ? { status: 'degraded', message: `outbox backlog ${backlog} exceeds ${max}` }
      : { status: 'ok', message: `outbox backlog ${backlog}` };
  }));

  if (options.drainSignal?.()) {
    checks.push({ name: 'drain', status: 'fail', latency_ms: 0, message: 'process is draining' });
  }

  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : checks.some((check) => check.status === 'degraded')
      ? 'degraded'
      : 'ok';
  return { status, timestamp: new Date().toISOString(), checks };
}

async function timedCheck(
  name: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  check: () => Promise<{ status: HealthCheckResult['status']; message?: string }> | { status: HealthCheckResult['status']; message?: string },
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(withSpan(`health.${name}`, { 'health.check': name }, check), timeoutMs);
    return { name, status: result.status, message: result.message, latency_ms: Date.now() - start };
  } catch (error) {
    return {
      name,
      status: 'fail',
      latency_ms: Date.now() - start,
      message: error instanceof Error ? error.message : 'unknown health check failure',
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
