export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type ContextName =
  | 'identity'
  | 'businessCatalog'
  | 'ordering'
  | 'paymentsBilling'
  | 'promotionsReferrals'
  | 'marketplaceReviews'
  | 'fulfilmentIntegrations'
  | 'notifications'
  | 'complianceAdmin'
  | 'reporting';

export type EntityId<Name extends string> = Brand<string, `${Name}Id`>;
export type UTCDateTime = Brand<string, 'UTCDateTime'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;

export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface ActorContext {
  readonly actorId: string;
  readonly tenantId?: string;
  readonly roles: readonly string[];
  readonly purpose: 'customer' | 'seller' | 'admin' | 'system';
}

export interface CommandMetadata {
  readonly commandId: string;
  readonly idempotencyKey: IdempotencyKey;
  readonly actor: ActorContext;
  readonly requestedAt: UTCDateTime;
  readonly correlationId: CorrelationId;
}

export interface CommandEnvelope<Name extends string, Payload> {
  readonly kind: 'command';
  readonly name: Name;
  readonly owner: ContextName;
  readonly metadata: CommandMetadata;
  readonly payload: Payload;
}

export interface QueryEnvelope<Name extends string, Parameters> {
  readonly kind: 'query';
  readonly name: Name;
  readonly owner: ContextName;
  readonly actor: ActorContext;
  readonly parameters: Parameters;
  readonly pagination?: PageRequest;
}

export interface DomainEventEnvelope<Name extends string, Payload> {
  readonly kind: 'event';
  readonly name: Name;
  readonly owner: ContextName;
  readonly schemaVersion: number;
  readonly eventId: string;
  readonly occurredAt: UTCDateTime;
  readonly correlationId: CorrelationId;
  readonly causationId?: string;
  readonly orderingKey: string;
  readonly retention: 'operational' | 'audit' | 'privacy-limited';
  readonly replay: {
    readonly owner: ContextName;
    readonly safe: boolean;
  };
  readonly payload: Payload;
}

export interface PageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface PageResult<T> {
  readonly data: readonly T[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export interface ProjectionCheckpoint {
  readonly projectionName: string;
  readonly owner: ContextName;
  readonly orderingKey: string;
  readonly lastEventId: string;
  readonly updatedAt: UTCDateTime;
}

export function asUTCDateTime(value: string): UTCDateTime {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`UTCDateTime must be ISO-8601 UTC: ${value}`);
  }
  return value as UTCDateTime;
}

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error('Money amount must be integer minor units');
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Money currency must be ISO-4217 uppercase code');
  }
  return { amountMinor, currency };
}

export function idempotencyKey(value: string): IdempotencyKey {
  if (value.trim().length < 8) {
    throw new Error('Idempotency key is too short');
  }
  return value as IdempotencyKey;
}

export function correlationId(value: string): CorrelationId {
  if (!value.trim()) throw new Error('Correlation id is required');
  return value as CorrelationId;
}

export function command<Name extends string, Payload>(
  owner: ContextName,
  name: Name,
  metadata: CommandMetadata,
  payload: Payload
): CommandEnvelope<Name, Payload> {
  return { kind: 'command', owner, name, metadata, payload };
}

export function event<Name extends string, Payload>(
  owner: ContextName,
  name: Name,
  options: Omit<DomainEventEnvelope<Name, Payload>, 'kind' | 'owner' | 'name'>
): DomainEventEnvelope<Name, Payload> {
  return { kind: 'event', owner, name, ...options };
}
