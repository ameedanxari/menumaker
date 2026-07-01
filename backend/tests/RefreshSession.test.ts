import { describe, expect, it, beforeEach } from '@jest/globals';
import { RefreshSessionStore } from '../src/models/RefreshSession';

const payload = { userId: '00000000-0000-0000-0000-000000000001', email: 'user@example.com' };

describe('RefreshSessionStore', () => {
  let store: RefreshSessionStore;

  beforeEach(() => {
    store = new RefreshSessionStore();
  });

  it('issues opaque refresh credentials and stores only hashes', async () => {
    const issued = await store.issue(payload, { userAgent: 'agent', ip: '203.0.113.40' });
    expect(issued.refreshToken).toBeTruthy();
    expect(store.all()[0].token_hash).not.toBe(issued.refreshToken);
    expect(JSON.stringify(store.all())).not.toContain(issued.refreshToken);
    expect(store.all()[0].ip_prefix).toBe('203.0.113');
  });

  it('rotates once and revokes family on rotated-token reuse', async () => {
    const issued = await store.issue(payload);
    const rotated = await store.rotate(issued.refreshToken);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    expect(store.all().find((session) => session.id === issued.session.id)?.rotated_at).toBeInstanceOf(Date);

    await expect(store.rotate(issued.refreshToken)).rejects.toThrow('reuse detected');
    expect(store.all().every((session) => session.revoked_at)).toBe(true);
    expect(store.all().some((session) => session.reuse_detected_at)).toBe(true);
  });

  it('revokes explicit session families and rejects expired tokens', async () => {
    const now = new Date('2026-06-20T00:00:00Z');
    const issued = await store.issue(payload, { now });
    await store.revokeSessionByToken(issued.refreshToken, new Date('2026-06-20T00:01:00Z'));
    await expect(store.rotate(issued.refreshToken)).rejects.toThrow('revoked');

    const expired = await store.issue(payload, { now: new Date('2020-01-01T00:00:00Z') });
    await expect(store.rotate(expired.refreshToken, undefined, { now })).rejects.toThrow('Expired');
  });
});
