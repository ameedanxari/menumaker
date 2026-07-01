#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [specPath = 'openapi/menumaker.v1.yaml', manifestPath = 'shared/mocks/manifest.json'] = process.argv.slice(2);
const root = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fail(message) {
  console.error(`❌ fixture validation: ${message}`);
  process.exitCode = 1;
}

const spec = readJson(specPath);
const manifest = readJson(manifestPath);
const operations = new Map();
for (const [apiPath, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(methods)) {
    operations.set(operation.operationId, { method: method.toUpperCase(), apiPath, operation });
  }
}

const seenKeys = new Set();
for (const fixture of manifest.fixtures ?? []) {
  const key = `${fixture.operation_id}:${fixture.status}:${fixture.scenario}`;
  if (seenKeys.has(key)) {
    fail(`duplicate fixture key ${key}`);
  }
  seenKeys.add(key);

  const operation = operations.get(fixture.operation_id);
  if (!operation) {
    fail(`${fixture.path} references unknown operation_id ${fixture.operation_id}`);
    continue;
  }
  const declaredStatus = operation.operation.responses?.[String(fixture.status)]
    ? String(fixture.status)
    : fixture.status === 200 && operation.operation.responses?.['201']
      ? '201'
      : null;
  if (!declaredStatus) {
    fail(`${fixture.path} references status ${fixture.status} not declared by ${fixture.operation_id}`);
  }
  const expectedHash = hash(operation.operation.responses);
  if (fixture.schema_hash !== expectedHash) {
    fail(`${fixture.path} schema_hash ${fixture.schema_hash} does not match ${expectedHash}`);
  }
  if (!fixture.scenario || !fixture.source || !Array.isArray(fixture.consumers) || fixture.consumers.length === 0) {
    fail(`${fixture.path} must declare scenario, source, and consumers`);
  }
  if (!String(fixture.path).startsWith(`shared/mocks/api/v1/${fixture.operation_id}/`)) {
    fail(`${fixture.path} must live under shared/mocks/api/v1/${fixture.operation_id}/`);
  }

  const body = readJson(fixture.path);
  if (typeof body.success !== 'boolean') {
    fail(`${fixture.path} must include boolean success`);
  }
  if (!('data' in body) && !('error' in body)) {
    fail(`${fixture.path} must include data or error envelope`);
  }
}

const manifestPaths = new Set((manifest.fixtures ?? []).map((fixture) => fixture.path));
const fixtureRoot = path.resolve(root, 'shared/mocks/api/v1');
if (fs.existsSync(fixtureRoot)) {
  for (const operationDir of fs.readdirSync(fixtureRoot)) {
    for (const file of fs.readdirSync(path.join(fixtureRoot, operationDir))) {
      if (!file.endsWith('.json')) continue;
      const relative = `shared/mocks/api/v1/${operationDir}/${file}`;
      if (!manifestPaths.has(relative)) {
        fail(`${relative} is not declared in manifest`);
      }
    }
  }
}

for (const productionRoot of ['frontend/src', 'android/app/src/main', 'ios/MenuMaker']) {
  const absolute = path.resolve(root, productionRoot);
  if (!fs.existsSync(absolute)) continue;
  const matches = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(next);
      else if (/\.(ts|tsx|kt|swift)$/.test(entry.name)) {
        const text = fs.readFileSync(next, 'utf8');
        if (/shared\/mocks\/api\/v1|api\/v1\/auth_login|canonical-fake-backend/.test(text)) {
          matches.push(path.relative(root, next));
        }
      }
    }
  };
  scan(absolute);
  if (matches.length > 0) {
    fail(`production source references API fixtures: ${matches.join(', ')}`);
  }
}

if (!process.exitCode) {
  console.log(`✅ fixture validation: ${manifest.fixtures.length} manifest fixtures match ${spec.openapi}`);
}
