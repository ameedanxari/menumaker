#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_FILE="$ROOT_DIR/backend/src/app.ts"
SPEC_FILE="${SPEC_OUT:-$ROOT_DIR/openapi/menumaker.v1.yaml}"

if [[ -d "/Applications/Codex.app/Contents/Resources/cua_node/bin" ]]; then
  export PATH="/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH"
fi

if ! java -version >/dev/null 2>&1 && [[ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

generate_spec() {
  export ROOT_DIR APP_FILE SPEC_FILE
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.ROOT_DIR || process.cwd();
const appFile = process.env.APP_FILE || path.join(root, 'backend/src/app.ts');
const specFile = process.env.SPEC_FILE || path.join(root, 'openapi/menumaker.v1.yaml');
const appSource = fs.readFileSync(appFile, 'utf8');
const operationRegex = /\{\s*method: '([^']+)', path: '([^']+)', operationId: '([^']+)', tag: '([^']+)'([^}]*)\}/g;
const operations = [];
let match;
while ((match = operationRegex.exec(appSource))) {
  operations.push({
    method: match[1].toLowerCase(),
    fastifyPath: match[2],
    operationId: match[3],
    tag: match[4],
    mutates: match[5].includes('mutates: true'),
    list: match[5].includes('list: true'),
    hasId: match[5].includes('hasId: true'),
  });
}

if (operations.length < 40) {
  throw new Error(`backend/src/app.ts exposed only ${operations.length} contract operations`);
}

const requiredTags = [
  'admin', 'auth', 'businesses', 'coupons', 'dishes', 'gdpr',
  'marketplace', 'media', 'menus', 'notifications', 'orders',
  'payments', 'payouts', 'referrals', 'reports', 'reviews',
  'settings',
];
const disabledTags = ['delivery', 'ocr', 'pos', 'subscriptions'];
const seenTags = new Set(operations.map((operation) => operation.tag));
const missingTags = requiredTags.filter((tag) => !seenTags.has(tag));
if (missingTags.length) {
  throw new Error(`missing required operation tags: ${missingTags.join(', ')}`);
}
const advertisedDisabledTags = disabledTags.filter((tag) => seenTags.has(tag));
if (advertisedDisabledTags.length) {
  throw new Error(`disabled capability operation tags must not be advertised: ${advertisedDisabledTags.join(', ')}`);
}

const schemas = {
  ErrorEnvelope: {
    type: 'object',
    required: ['error'],
    additionalProperties: false,
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'request_id'],
        additionalProperties: false,
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          request_id: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
  Pagination: {
    type: 'object',
    required: ['limit', 'has_more'],
    additionalProperties: false,
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      cursor: { type: 'string' },
      next_cursor: { type: 'string' },
      has_more: { type: 'boolean' },
    },
  },
  Resource: {
    type: 'object',
    required: ['id', 'created_at', 'updated_at'],
    additionalProperties: true,
    properties: {
      id: { type: 'string' },
      created_at: { type: 'string', format: 'date-time', description: 'ISO-8601 UTC string.' },
      updated_at: { type: 'string', format: 'date-time', description: 'ISO-8601 UTC string.' },
      amount_minor: { type: 'integer', description: 'Integer minor currency units.' },
      order_status: {
        type: 'string',
        enum: ['draft', 'pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'refunded'],
      },
      payment_status: {
        type: 'string',
        enum: ['requires_payment_method', 'requires_confirmation', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'],
      },
    },
  },
  SuccessEnvelope: {
    type: 'object',
    required: ['data'],
    additionalProperties: false,
    properties: {
      data: { $ref: '#/components/schemas/Resource' },
    },
  },
  ListEnvelope: {
    type: 'object',
    required: ['data', 'pagination'],
    additionalProperties: false,
    properties: {
      data: { type: 'array', items: { $ref: '#/components/schemas/Resource' } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  },
  WriteBody: { type: 'object', minProperties: 1, additionalProperties: true },
};

const responses = {
  Error400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  Error401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  Error403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  Error404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  Error409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  Error422: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  Error500: { description: 'Internal error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
};

const paths = {};
for (const operation of operations) {
  const openapiPath = operation.fastifyPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  const parameters = [];
  if (operation.hasId) {
    parameters.push({ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1 } });
  }
  if (operation.list) {
    parameters.push(
      { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
      { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
    );
  }
  if (operation.mutates) {
    parameters.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', minLength: 8 } });
  }
  paths[openapiPath] ||= {};
  paths[openapiPath][operation.method] = {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: `${operation.method.toUpperCase()} ${openapiPath}`,
    description: [
      'Canonical /api/v1 transport operation.',
      'Wire fields are snake_case; date-time values are ISO-8601 UTC strings.',
      operation.mutates ? 'Mutating requests support Idempotency-Key.' : 'Read-only request.',
    ].join(' '),
    ...(parameters.length ? { parameters } : {}),
    ...(operation.mutates ? {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/WriteBody' } } },
      },
    } : {}),
    responses: {
      [operation.method === 'post' ? '201' : '200']: {
        description: 'Success',
        content: {
          'application/json': {
            schema: { $ref: operation.list ? '#/components/schemas/ListEnvelope' : '#/components/schemas/SuccessEnvelope' },
          },
        },
      },
      '400': { $ref: '#/components/responses/Error400' },
      '401': { $ref: '#/components/responses/Error401' },
      '403': { $ref: '#/components/responses/Error403' },
      '404': { $ref: '#/components/responses/Error404' },
      '409': { $ref: '#/components/responses/Error409' },
      '422': { $ref: '#/components/responses/Error422' },
      '500': { $ref: '#/components/responses/Error500' },
    },
    security: operation.tag === 'auth' && operation.operationId !== 'auth_get_me' ? [] : [{ bearerAuth: [] }],
  };
}

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'MenuMaker API',
    version: '1.0.0',
    description: 'Canonical OpenAPI 3.1 contract for MenuMaker /api/v1 generated clients.',
  },
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  servers: [{ url: '/api/v1', description: 'Version-one API root' }],
  tags: requiredTags.map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
    responses,
  },
  'x-generated-from': 'backend/src/app.ts contractOperations',
  'x-wire-policy': {
    version_prefix: '/api/v1',
    field_case: 'snake_case',
    dates: 'ISO-8601 UTC',
    money: 'integer minor currency units',
    idempotency_header: 'Idempotency-Key',
  },
};

fs.mkdirSync(path.dirname(specFile), { recursive: true });
fs.writeFileSync(specFile, `${JSON.stringify(spec, null, 2)}\n`);
NODE
}

validate_spec() {
  export SPEC_FILE
  node --input-type=module <<'NODE'
import fs from 'node:fs';
const specFile = process.env.SPEC_FILE;
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const requiredTags = new Set(['auth', 'businesses', 'menus', 'dishes', 'orders', 'payments', 'payouts', 'coupons', 'marketplace', 'reviews', 'referrals', 'notifications', 'settings', 'admin', 'gdpr', 'media', 'reports']);
const disabledTags = new Set(['delivery', 'ocr', 'pos', 'subscriptions']);
if (spec.openapi !== '3.1.0') throw new Error(`${specFile}: expected OpenAPI 3.1.0`);
const seenOperationIds = new Set();
const seenTags = new Set();
for (const [route, methods] of Object.entries(spec.paths ?? {})) {
  if (!route.startsWith('/api/v1/')) throw new Error(`${specFile}: route outside /api/v1: ${route}`);
  if (route.includes(':')) throw new Error(`${specFile}: route must use OpenAPI path params, not Fastify colons: ${route}`);
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation.operationId) throw new Error(`${specFile}: ${method.toUpperCase()} ${route} missing operationId`);
    if (seenOperationIds.has(operation.operationId)) throw new Error(`${specFile}: duplicate operationId ${operation.operationId}`);
    seenOperationIds.add(operation.operationId);
    for (const tag of operation.tags ?? []) seenTags.add(tag);
    for (const tag of operation.tags ?? []) {
      if (disabledTags.has(tag)) throw new Error(`${specFile}: disabled capability tag is advertised: ${tag}`);
    }
    if (!operation.responses?.['400'] || !operation.responses?.['500']) {
      throw new Error(`${specFile}: ${operation.operationId} missing shared error responses`);
    }
  }
}
for (const tag of requiredTags) {
  if (!seenTags.has(tag)) throw new Error(`${specFile}: missing required tag ${tag}`);
}
if (seenOperationIds.size < 40) throw new Error(`${specFile}: expected at least 40 operations, found ${seenOperationIds.size}`);
console.log(`contract valid: ${seenOperationIds.size} operations across ${seenTags.size} tags`);
NODE
}

backend_contract_test() {
  local generated
  generated="$(mktemp)"
  ROOT_DIR="$ROOT_DIR" APP_FILE="$APP_FILE" SPEC_FILE="$generated" generate_spec
  SPEC_FILE="$generated" validate_spec
  cmp -s "$generated" "$ROOT_DIR/openapi/menumaker.v1.yaml" || {
    echo "openapi/menumaker.v1.yaml is stale; run npm run api:generate --workspace=backend" >&2
    diff -u "$ROOT_DIR/openapi/menumaker.v1.yaml" "$generated" | sed -n '1,160p' >&2
    exit 1
  }
  rm -f "$generated"
}

breaking_check() {
  SPEC_FILE="$ROOT_DIR/openapi/menumaker.v1.yaml" validate_spec
  if [[ -f "$ROOT_DIR/openapi/menumaker.v1.baseline.yaml" ]]; then
    node --input-type=module <<'NODE'
import fs from 'node:fs';
const current = JSON.parse(fs.readFileSync('openapi/menumaker.v1.yaml', 'utf8'));
const baseline = JSON.parse(fs.readFileSync('openapi/menumaker.v1.baseline.yaml', 'utf8'));
const currentIds = new Set(Object.values(current.paths).flatMap((methods) => Object.values(methods).map((operation) => operation.operationId)));
const removed = Object.values(baseline.paths).flatMap((methods) => Object.values(methods).map((operation) => operation.operationId)).filter((id) => !currentIds.has(id));
if (removed.length) throw new Error(`breaking operations removed: ${removed.join(', ')}`);
NODE
  fi
}

case "${1:-}" in
  --backend-generate)
    ROOT_DIR="$ROOT_DIR" APP_FILE="$APP_FILE" SPEC_FILE="$SPEC_FILE" generate_spec
    ;;
  --backend-breaking-check)
    breaking_check
    ;;
  --backend-contract-test)
    backend_contract_test
    ;;
  --check)
    backend_contract_test
    breaking_check
    ;;
  "")
    backend_contract_test
    breaking_check
    (cd "$ROOT_DIR" && npm run api:generate --workspace=shared)
    (cd "$ROOT_DIR/ios" && bash Scripts/generate-openapi-client.sh --check)
    (cd "$ROOT_DIR/android" && ./gradlew openApiGenerate)
    ;;
  *)
    echo "Usage: $0 [--backend-generate|--backend-breaking-check|--backend-contract-test|--check]" >&2
    exit 64
    ;;
esac
