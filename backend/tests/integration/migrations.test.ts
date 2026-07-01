import { describe, expect, it } from '@jest/globals';
import { Client } from 'pg';
import { createAppDataSource } from '../../src/config/database';

const url = process.env.MIGRATION_TEST_DATABASE_URL || 'postgresql://menumaker:menumaker@localhost:5432/menumaker_migration_test';

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe('migrations', () => {
  it('creates representative Tier 0 relations and keeps identity stable', async () => {
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = 'test';
    process.env.DB_MIGRATION_JOB = 'true';

    await withClient(async (client) => {
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      expect(tables.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining([
        'users',
        'businesses',
        'menus',
        'orders',
        'payments',
        'audit_logs',
        'deletion_requests',
      ]));

      await client.query(`
        INSERT INTO users (id, email, name) VALUES
        ('00000000-0000-0000-0000-000000000001', 'owner@example.com', 'Owner'),
        ('00000000-0000-0000-0000-000000000002', 'customer@example.com', 'Customer')
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO businesses (id, owner_id, name, slug)
        VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Cafe', 'cafe')
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO menus (id, business_id, name)
        VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Main')
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO orders (id, customer_id, business_id, status, total_cents)
        VALUES ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'pending', 1299)
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO payments (id, order_id, business_id, amount_cents, status)
        VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1299, 'succeeded')
        ON CONFLICT DO NOTHING
      `);

      const counts = await client.query(`
        SELECT
          (SELECT count(*)::int FROM users) AS users,
          (SELECT count(*)::int FROM businesses) AS businesses,
          (SELECT count(*)::int FROM orders) AS orders,
          (SELECT count(*)::int FROM payments) AS payments
      `);
      expect(counts.rows[0]).toMatchObject({ users: 2, businesses: 1, orders: 1, payments: 1 });

      const checksum = await client.query(`
        SELECT md5(string_agg(id::text || ':' || status || ':' || amount_cents::text, ',' ORDER BY id)) AS checksum
        FROM payments
      `);
      expect(checksum.rows[0].checksum).toHaveLength(32);
    });
  });

  it('has zero pending migrations after clean install', async () => {
    const dataSource = createAppDataSource({
      ...process.env,
      DATABASE_URL: url,
      NODE_ENV: 'test',
      DB_MIGRATION_JOB: 'true',
    } as NodeJS.ProcessEnv);
    await dataSource.initialize();
    try {
      expect(await dataSource.showMigrations()).toBe(false);
    } finally {
      await dataSource.destroy();
    }
  });
});
