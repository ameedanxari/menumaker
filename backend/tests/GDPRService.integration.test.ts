import { GDPRService, PrivacyDataLocation } from '../src/services/GDPRService.js';

describe('GDPRService privacy export and deletion evidence', () => {
  const userId = 'user-privacy-1';

  const locations: PrivacyDataLocation[] = [
    {
      id: 'users',
      kind: 'table',
      owner: 'identity',
      subject_user_id: userId,
      exportable: true,
      deletion_strategy: 'delete',
      data: { id: userId, email: 'user@example.test', password_hash: 'secret-hash' },
    },
    {
      id: 'orders',
      kind: 'table',
      owner: 'ordering',
      subject_user_id: userId,
      tenant_id: 'business-1',
      exportable: true,
      deletion_strategy: 'anonymize',
      data: [{ id: 'order-1', customer_name: 'Privacy User', access_token: 'must-not-export' }],
    },
    {
      id: 'payment_processors',
      kind: 'table',
      owner: 'payments',
      subject_user_id: userId,
      exportable: false,
      contains_secret: true,
      deletion_strategy: 'delete',
      data: { secret_key: 'sk_live_sensitive' },
    },
    {
      id: 'tax_invoices',
      kind: 'table',
      owner: 'tax',
      subject_user_id: userId,
      exportable: true,
      legal_hold: true,
      retention_rationale: 'statutory tax retention',
      deletion_strategy: 'retain_with_rationale',
      data: { id: 'invoice-1', total_cents: 1200 },
    },
    {
      id: 'media_objects',
      kind: 'blob',
      owner: 'media',
      subject_user_id: userId,
      exportable: true,
      deletion_strategy: 'delete',
      data: { key: 'media/user-privacy-1/dish.jpg', checksum: 'abc' },
    },
    {
      id: 'stripe_processor_request',
      kind: 'processor',
      owner: 'privacy',
      processor: 'Stripe',
      subject_user_id: userId,
      exportable: true,
      deletion_strategy: 'delete',
      data: { status: 'queued' },
    },
  ];

  it('builds a signed export manifest without secrets and with all locations represented', () => {
    const manifest = GDPRService.buildExportManifest(userId, locations, new Date('2026-06-20T00:00:00Z'));

    expect(manifest.format).toBe('menumaker-privacy-export-v1');
    expect(manifest.locations).toHaveLength(locations.length);
    expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.locations.find((item) => item.id === 'payment_processors')?.status).toBe('excluded_secret');
    expect(JSON.stringify(manifest)).not.toContain('sk_live_sensitive');
    expect(JSON.stringify(manifest)).not.toContain('must-not-export');
  });

  it('blocks cross-tenant export attempts', () => {
    expect(() =>
      GDPRService.buildExportManifest(userId, [
        ...locations,
        {
          id: 'other-user-order',
          kind: 'table',
          owner: 'ordering',
          subject_user_id: 'other-user',
          exportable: true,
          deletion_strategy: 'delete',
        },
      ])
    ).toThrow(/Cross-tenant export blocked/);
  });

  it('requires destructive approval and records legal-hold rationale', () => {
    expect(() => GDPRService.executeDeletionPlan(userId, locations)).toThrow(/requires approval/);

    const result = GDPRService.executeDeletionPlan(userId, locations, { approvedBy: 'admin-1' });
    expect(result.complete).toBe(true);
    expect(result.evidence.find((item) => item.location_id === 'tax_invoices')).toMatchObject({
      status: 'retained',
      retained_record_rationale: 'statutory tax retention',
    });
    expect(result.evidence.find((item) => item.location_id === 'media_objects')?.evidence).toContain('sha256');
  });

  it('does not mark failed provider/blob/table steps complete until resumed', () => {
    const failed = GDPRService.executeDeletionPlan(userId, locations, {
      approvedBy: 'admin-1',
      failedLocationIds: ['media_objects', 'stripe_processor_request'],
    });

    expect(failed.complete).toBe(false);
    expect(failed.evidence.filter((item) => item.status === 'failed')).toHaveLength(2);

    const resumed = GDPRService.resumeDeletionPlan(failed, locations, { approvedBy: 'admin-2' });
    expect(resumed.complete).toBe(true);
    expect(resumed.evidence.filter((item) => item.status === 'failed')).toHaveLength(0);
  });
});
