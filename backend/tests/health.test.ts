import Fastify from 'fastify';
import { describe, expect, it } from '@jest/globals';
import { createHealthRoutes, readinessReport } from '../src/routes/health';

const initializedOrm = {
  isInitialized: true,
  query: async () => [{ ok: 1 }],
  showMigrations: async () => false,
};

describe('health routes', () => {
  it('keeps liveness healthy when dependencies are down but readiness fails', async () => {
    const app = Fastify({ logger: false });
    await app.register(createHealthRoutes({
      orm: { ...initializedOrm, isInitialized: false },
      requiredSecrets: [],
    }));

    const live = await app.inject({ method: 'GET', url: '/health/live' });
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(live.statusCode).toBe(200);
    expect(ready.statusCode).toBe(503);
    expect(ready.json().checks.find((check: { name: string }) => check.name === 'database').status).toBe('fail');
    await app.close();
  });

  it('reports degraded readiness for optional capability and outbox lag', async () => {
    const report = await readinessReport({
      orm: initializedOrm,
      capabilityChecks: { stripe: () => false },
      outboxBacklog: () => 900,
      maxOutboxBacklog: 100,
    });
    expect(report.status).toBe('degraded');
    expect(report.checks.map((check) => check.name)).toEqual(expect.arrayContaining(['capability:stripe', 'outbox_backlog']));
  });

  it('fails readiness while draining and hides diagnostics without admin token', async () => {
    const app = Fastify({ logger: false });
    await app.register(createHealthRoutes({
      orm: initializedOrm,
      drainSignal: () => true,
      adminToken: 'admin-token',
    }));

    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    const unauthenticatedDiagnostics = await app.inject({ method: 'GET', url: '/health/diagnostics' });
    const authenticatedDiagnostics = await app.inject({
      method: 'GET',
      url: '/health/diagnostics',
      headers: { authorization: 'Bearer admin-token' },
    });

    expect(ready.statusCode).toBe(503);
    expect(unauthenticatedDiagnostics.statusCode).toBe(404);
    expect(authenticatedDiagnostics.statusCode).toBe(200);
    expect(authenticatedDiagnostics.json().drain).toBe(true);
    expect(JSON.stringify(authenticatedDiagnostics.json())).not.toMatch(/postgres:\/\/|password|secret/i);
    await app.close();
  });
});
