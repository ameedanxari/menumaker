#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const tsconfigPath = path.join(root, 'backend/tsconfig.json');
const jestConfigPath = path.join(root, 'backend/jest.config.js');
const debtPath = path.join(root, 'backend/strict-compiler-debt.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
  console.error(`❌ strict compiler baseline: ${message}`);
  process.exitCode = 1;
}

const tsconfig = readJson(tsconfigPath);
const debt = readJson(debtPath);
const compiler = tsconfig.compilerOptions ?? {};

for (const [key, expected] of Object.entries({
  noEmitOnError: true,
  forceConsistentCasingInFileNames: true,
  noFallthroughCasesInSwitch: true,
})) {
  if (compiler[key] !== expected) {
    fail(`backend/tsconfig.json must set compilerOptions.${key}=${expected}`);
  }
}

const includes = new Set(tsconfig.include ?? []);
if (!includes.has('src/**/*')) {
  fail('backend/tsconfig.json must include all production source via src/**/*');
}

const excludes = new Set(tsconfig.exclude ?? []);
for (const forbidden of debt.production_compile_scope?.forbidden_excludes ?? []) {
  if (excludes.has(forbidden)) {
    fail(`backend/tsconfig.json excludes production source path ${forbidden}`);
  }
}

let total = 0;
const today = new Date().toISOString().slice(0, 10);
for (const baseline of debt.baselines ?? []) {
  total += Number(baseline.current_count ?? 0);
  if (Number(baseline.current_count) > Number(baseline.max_allowed)) {
    fail(`${baseline.key} increased from max ${baseline.max_allowed} to ${baseline.current_count}`);
  }
  if (!baseline.owner || !baseline.expires_on || baseline.expires_on < today) {
    fail(`${baseline.key} must have an owner and non-expired expires_on date`);
  }
  if (compiler[baseline.key] === true && baseline.current_count !== 0) {
    fail(`${baseline.key} is enabled but still has debt count ${baseline.current_count}`);
  }
}

if (total > Number(debt.max_allowed_total)) {
  fail(`total strictness debt increased from max ${debt.max_allowed_total} to ${total}`);
}

const jestConfig = fs.readFileSync(jestConfigPath, 'utf8');
if (/ignoreCodes\s*:/.test(jestConfig)) {
  fail('backend/jest.config.js must not ignore ts-jest diagnostic codes');
}
if (/strict\s*:\s*false/.test(jestConfig)) {
  fail('backend/jest.config.js must not force strict=false for tests');
}

if (!process.exitCode) {
  console.log(`✅ strict compiler baseline: pass — debt=${total}/${debt.max_allowed_total}`);
}
