import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

type GateMetric = {
  name: string;
  status: 'pass' | 'fail';
  raw_artifact: string;
  coverage?: number;
  previous_coverage?: number;
  mutation_score?: number;
  previous_mutation_score?: number;
  retries?: number;
  skipped?: number;
  only?: number;
};

type QualityInput = {
  commit: string;
  platform: string;
  generated_at: string;
  thresholds: {
    critical_coverage_min: number;
    mutation_score_min: number;
    changed_file_coverage_min: number;
  };
  gates: GateMetric[];
  changed_files: Array<{ path: string; coverage: number; raw_artifact: string }>;
  dashboard: {
    kpi: string[];
    filter: string[];
    chart: Array<{ id: string; tooltip: string; legend: string }>;
    table: Array<{ label: string; value: number | string }>;
  };
};

type QualityReport = {
  commit: string;
  platform: string;
  generated_at: string;
  status: 'pass' | 'fail';
  failures: string[];
  dashboard: QualityInput['dashboard'];
  raw_artifacts: string[];
};

function readJson(file: string): QualityInput {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as QualityInput;
}

function evaluate(input: QualityInput): QualityReport {
  const failures: string[] = [];
  const rawArtifacts = new Set<string>();

  for (const gate of input.gates) {
    rawArtifacts.add(gate.raw_artifact);
    if (gate.status !== 'pass') {
      failures.push(`${gate.name} failed`);
    }
    if ((gate.skipped ?? 0) > 0) {
      failures.push(`${gate.name} introduced skipped tests`);
    }
    if ((gate.only ?? 0) > 0) {
      failures.push(`${gate.name} contains focused .only tests`);
    }
    if ((gate.retries ?? 0) > 0) {
      failures.push(`${gate.name} only passed after retry`);
    }
    if (gate.coverage !== undefined) {
      if (gate.coverage < input.thresholds.critical_coverage_min) {
        failures.push(`${gate.name} critical coverage ${gate.coverage} below ${input.thresholds.critical_coverage_min}`);
      }
      if (gate.previous_coverage !== undefined && gate.coverage < gate.previous_coverage) {
        failures.push(`${gate.name} reduced critical coverage from ${gate.previous_coverage} to ${gate.coverage}`);
      }
    }
    if (gate.mutation_score !== undefined) {
      if (gate.mutation_score < input.thresholds.mutation_score_min) {
        failures.push(`${gate.name} mutation score ${gate.mutation_score} below ${input.thresholds.mutation_score_min}`);
      }
      if (gate.previous_mutation_score !== undefined && gate.mutation_score < gate.previous_mutation_score) {
        failures.push(`${gate.name} mutation score regressed from ${gate.previous_mutation_score} to ${gate.mutation_score}`);
      }
    }
  }

  for (const file of input.changed_files) {
    rawArtifacts.add(file.raw_artifact);
    if (file.coverage < input.thresholds.changed_file_coverage_min) {
      failures.push(`${file.path} changed-file coverage ${file.coverage} below ${input.thresholds.changed_file_coverage_min}`);
    }
  }

  if (!input.dashboard?.kpi?.length || !input.dashboard?.filter?.length) {
    failures.push('dashboard must expose kpi and filter metadata');
  }
  if (!input.dashboard?.chart?.every((chart) => chart.tooltip && chart.legend)) {
    failures.push('dashboard charts must expose tooltip and legend metadata');
  }
  if (!input.dashboard?.table?.length) {
    failures.push('dashboard must expose table rows');
  }

  return {
    commit: input.commit,
    platform: input.platform,
    generated_at: input.generated_at,
    status: failures.length > 0 ? 'fail' : 'pass',
    failures,
    dashboard: input.dashboard,
    raw_artifacts: [...rawArtifacts].sort(),
  };
}

function writeMarkdown(report: QualityReport): string {
  const lines = [
    '# Quality Report',
    '',
    `- Commit: ${report.commit}`,
    `- Platform: ${report.platform}`,
    `- Status: ${report.status}`,
    '',
    '## Dashboard',
    '',
    `- kpi: ${report.dashboard.kpi.join(', ')}`,
    `- filter: ${report.dashboard.filter.join(', ')}`,
    `- chart: ${report.dashboard.chart.map((chart) => `${chart.id} (tooltip: ${chart.tooltip}; legend: ${chart.legend})`).join(', ')}`,
    `- table rows: ${report.dashboard.table.length}`,
    '',
    '## Raw artifacts',
    '',
    ...report.raw_artifacts.map((artifact) => `- ${artifact}`),
    '',
    '## Failures',
    '',
    ...(report.failures.length ? report.failures.map((failure) => `- ${failure}`) : ['- none']),
    '',
  ];
  return lines.join('\n');
}

function runOne(file: string, outputDir?: string): QualityReport {
  const report = evaluate(readJson(file));
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'quality-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outputDir, 'quality-report.md'), writeMarkdown(report));
  }
  return report;
}

function runFixtures(fixturesDir: string): number {
  let failures = 0;
  for (const dirent of fs.readdirSync(fixturesDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const inputPath = path.join(fixturesDir, dirent.name, 'quality-input.json');
    const report = runOne(inputPath);
    const expectedPass = dirent.name === 'good';
    if (expectedPass && report.status !== 'pass') {
      console.error(`❌ ${dirent.name} should pass: ${report.failures.join('; ')}`);
      failures += 1;
    }
    if (!expectedPass && report.status !== 'fail') {
      console.error(`❌ ${dirent.name} should fail`);
      failures += 1;
    }
  }
  if (failures === 0) {
    console.log('✅ quality report fixtures: pass');
  }
  return failures === 0 ? 0 : 1;
}

const args = process.argv.slice(2);
const fixturesIndex = args.indexOf('--fixtures');
if (fixturesIndex >= 0) {
  process.exit(runFixtures(args[fixturesIndex + 1] ?? 'scripts/quality/fixtures'));
}

const inputIndex = args.indexOf('--input');
const outputIndex = args.indexOf('--output-dir');
if (inputIndex < 0 || !args[inputIndex + 1]) {
  console.error('Usage: node --import tsx scripts/quality/build-quality-report.ts --input <quality-input.json> [--output-dir <dir>]');
  console.error('       node --import tsx scripts/quality/build-quality-report.ts --fixtures scripts/quality/fixtures');
  process.exit(2);
}

const report = runOne(args[inputIndex + 1], outputIndex >= 0 ? args[outputIndex + 1] : undefined);
if (report.status === 'fail') {
  console.error(report.failures.join('\n'));
  process.exit(1);
}
console.log('✅ quality report: pass');
