import crypto from 'node:crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  generateAccessToken,
  generateOpaqueRefreshCredential,
  hashCredential,
  type JWTPayload,
} from '../utils/jwt.js';

@Entity('refresh_sessions')
@Index('idx_refresh_sessions_active_user', ['user_id', 'revoked_at', 'expires_at'])
@Index('idx_refresh_sessions_family', ['family_id'])
@Index('idx_refresh_sessions_token_hash', ['token_hash'], { unique: true })
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'uuid' })
  family_id!: string;

  @Column({ type: 'varchar', length: 128 })
  token_hash!: string;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  rotated_at?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replaced_by_id?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reuse_detected_at?: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  user_agent_hash?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_prefix?: string | null;
}

export interface RefreshSessionMetadata {
  userAgent?: string;
  ip?: string;
  now?: Date;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  session: RefreshSession;
}

export class RefreshSessionStore {
  private sessions = new Map<string, RefreshSession>();
  private payloads = new Map<string, JWTPayload>();

  async issue(payload: JWTPayload, metadata: RefreshSessionMetadata = {}): Promise<IssuedSession> {
    const now = metadata.now ?? new Date();
    const refreshToken = generateOpaqueRefreshCredential();
    const session = this.createSession(payload.userId, refreshToken, now, metadata);
    this.sessions.set(session.id, session);
    this.payloads.set(session.id, payload);
    return {
      accessToken: generateAccessToken(payload, { sid: session.id }),
      refreshToken,
      session,
    };
  }

  async rotate(refreshToken: string, payload?: JWTPayload, metadata: RefreshSessionMetadata = {}): Promise<IssuedSession> {
    const now = metadata.now ?? new Date();
    const tokenHash = hashCredential(refreshToken);
    const current = [...this.sessions.values()].find((session) => session.token_hash === tokenHash);
    if (!current) throw new Error('Invalid refresh token');
    if (current.expires_at <= now || current.revoked_at) throw new Error('Expired or revoked refresh token');
    if (current.rotated_at || current.replaced_by_id) {
      await this.revokeFamily(current.family_id, now, true);
      throw new Error('Refresh token reuse detected');
    }

    const nextPayload = payload ?? this.payloads.get(current.id);
    if (!nextPayload) throw new Error('Refresh session payload missing');
    const nextToken = generateOpaqueRefreshCredential();
    const next = this.createSession(nextPayload.userId, nextToken, now, metadata, current.family_id);
    current.rotated_at = now;
    current.replaced_by_id = next.id;
    this.sessions.set(current.id, current);
    this.sessions.set(next.id, next);
    this.payloads.set(next.id, nextPayload);
    return {
      accessToken: generateAccessToken(nextPayload, { sid: next.id }),
      refreshToken: nextToken,
      session: next,
    };
  }

  async revokeFamily(familyId: string, now = new Date(), reuseDetected = false): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.family_id !== familyId) continue;
      session.revoked_at = session.revoked_at ?? now;
      if (reuseDetected) session.reuse_detected_at = session.reuse_detected_at ?? now;
    }
  }

  async revokeSessionByToken(refreshToken: string, now = new Date()): Promise<void> {
    const tokenHash = hashCredential(refreshToken);
    const session = [...this.sessions.values()].find((candidate) => candidate.token_hash === tokenHash);
    if (session) await this.revokeFamily(session.family_id, now, false);
  }

  async revokeUser(userId: string, now = new Date()): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.user_id === userId) session.revoked_at = session.revoked_at ?? now;
    }
  }

  all(): RefreshSession[] {
    return [...this.sessions.values()];
  }

  clear(): void {
    this.sessions.clear();
    this.payloads.clear();
  }

  private createSession(
    userId: string,
    refreshToken: string,
    now: Date,
    metadata: RefreshSessionMetadata,
    familyId: string = crypto.randomUUID(),
  ): RefreshSession {
    const session = new RefreshSession();
    session.id = crypto.randomUUID();
    session.user_id = userId;
    session.family_id = familyId;
    session.token_hash = hashCredential(refreshToken);
    session.created_at = now;
    session.expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    session.rotated_at = null;
    session.revoked_at = null;
    session.replaced_by_id = null;
    session.reuse_detected_at = null;
    session.user_agent_hash = metadata.userAgent ? hashCredential(metadata.userAgent) : null;
    session.ip_prefix = metadata.ip ? ipPrefix(metadata.ip) : null;
    return session;
  }
}

export const refreshSessionStore = new RefreshSessionStore();

function ipPrefix(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':');
  return ip.split('.').slice(0, 3).join('.');
}
