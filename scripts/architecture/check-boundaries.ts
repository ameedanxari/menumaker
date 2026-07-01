import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type Violation = {
  file: string;
  code: string;
  message: string;
};

const layerRank: Record<string, number> = {
  domain: 0,
  application: 1,
  infrastructure: 2,
  http: 3,
};

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  return entries.filter((file) => file.endsWith('.ts'));
}

function segment(file: string, candidates: string[]): string | null {
  const parts = file.split(path.sep);
  return candidates.find((candidate) => parts.includes(candidate)) ?? null;
}

function contextName(file: string): string | null {
  const parts = file.split(path.sep);
  const contextsIndex = parts.indexOf('contexts');
  if (contextsIndex >= 0 && parts[contextsIndex + 1]) return parts[contextsIndex + 1];
  const fixturesIndex = parts.indexOf('fixtures');
  if (fixturesIndex >= 0 && parts[fixturesIndex + 1]) return parts[fixturesIndex + 1];
  return null;
}

function importSpecifiers(source: string): string[] {
  const imports: string[] = [];
  const re = /\bfrom\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    imports.push(match[1] || match[2]);
  }
  return imports;
}

function resolveImport(file: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const resolved = path.normalize(path.join(path.dirname(file), specifier));
  for (const candidate of [resolved, `${resolved}.ts`, path.join(resolved, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return `${resolved}.ts`;
}

function scanFile(file: string): Violation[] {
  const source = readFileSync(file, 'utf8');
  const ownLayer = segment(file, Object.keys(layerRank));
  const ownContext = contextName(file);
  const violations: Violation[] = [];

  for (const specifier of importSpecifiers(source)) {
    const resolved = resolveImport(file, specifier);
    if (!resolved) continue;

    const importedLayer = segment(resolved, Object.keys(layerRank));
    const importedContext = contextName(resolved);

    if (ownLayer && importedLayer && layerRank[importedLayer] > layerRank[ownLayer]) {
      violations.push({
        file,
        code: 'layer-direction',
        message: `${ownLayer} code may not import ${importedLayer}: ${specifier}`,
      });
    }

    const privateAccess = /\/(repository|repositories|models?|entities)\//.test(resolved.replaceAll(path.sep, '/'));
    if (ownContext && importedContext && ownContext !== importedContext && privateAccess) {
      violations.push({
        file,
        code: 'cross-context-private-access',
        message: `${ownContext} may not import private ${importedContext} state: ${specifier}`,
      });
    }

    if (source.includes('@architecture-fixture:cycle')) {
      violations.push({
        file,
        code: 'context-cycle',
        message: 'fixture marks a context dependency cycle that must be rejected',
      });
    }
  }

  return violations;
}

function runFixtures(fixturesDir: string): number {
  const validFiles = walk(path.join(fixturesDir, 'valid'));
  const invalidFiles = walk(fixturesDir).filter((file) => file.includes(`${path.sep}invalid-`));

  const validViolations = validFiles.flatMap(scanFile);
  const invalidViolations = invalidFiles.flatMap(scanFile);
  const hasCrossOwner = invalidViolations.some((v) => v.code === 'cross-context-private-access');
  const hasCycle = invalidViolations.some((v) => v.code === 'context-cycle');

  if (validViolations.length || !hasCrossOwner || !hasCycle) {
    console.error('❌ boundary fixture verification failed');
    for (const violation of [...validViolations, ...invalidViolations]) {
      console.error(` - ${violation.code}: ${violation.file}: ${violation.message}`);
    }
    if (!hasCrossOwner) console.error(' - invalid fixtures did not trigger cross-context-private-access');
    if (!hasCycle) console.error(' - invalid fixtures did not trigger context-cycle');
    return 1;
  }

  console.log(`✅ boundary fixtures accepted valid=${validFiles.length} rejected invalid=${invalidFiles.length}`);
  return 0;
}

function main(): number {
  const fixturesFlag = process.argv.indexOf('--fixtures');
  if (fixturesFlag >= 0) {
    const fixturesDir = process.argv[fixturesFlag + 1];
    if (!fixturesDir) {
      console.error('usage: check-boundaries.ts --fixtures <dir>');
      return 2;
    }
    return runFixtures(fixturesDir);
  }

  const sourceRoot = process.argv[2] ?? 'backend/src/contexts';
  const violations = walk(sourceRoot).flatMap(scanFile);
  if (violations.length) {
    console.error('❌ boundary violations found');
    for (const violation of violations) {
      console.error(` - ${violation.code}: ${violation.file}: ${violation.message}`);
    }
    return 1;
  }
  console.log('✅ boundary check passed');
  return 0;
}

process.exitCode = main();
