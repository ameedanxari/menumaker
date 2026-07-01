import { describe, expect, it } from '@jest/globals';
import {
  AppDataSource,
  assertProductionSafeDatabaseConfig,
  getPendingMigrationNames,
} from '../src/config/database';

describe('database config', () => {
  it('rejects local synchronize in production', () => {
    expect(() =>
      assertProductionSafeDatabaseConfig({
        NODE_ENV: 'production',
        DB_SYNCHRONIZE_LOCAL: 'true',
      })
    ).toThrow('DB_SYNCHRONIZE_LOCAL');
  });

  it('registers migrations and migration table name', () => {
    expect(AppDataSource.options.migrationsTableName).toBe('schema_migrations');
    expect(AppDataSource.options.synchronize).toBe(false);
    expect(String(AppDataSource.options.migrations?.[0])).toContain('InitialMenuMakerSchema');
  });

  it('reports pending migration ids for startup preflight', async () => {
    const names = await getPendingMigrationNames({
      showMigrations: async () => true,
      migrations: [{ name: 'InitialMenuMakerSchema1718841600000' }],
    });
    expect(names).toEqual(['InitialMenuMakerSchema1718841600000']);
  });
});
