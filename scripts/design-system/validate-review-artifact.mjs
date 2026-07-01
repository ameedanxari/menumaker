#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const target = path.resolve(process.cwd(), process.argv[2] ?? 'docs/ui-consistency/review/index.html');
const html = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
const errors = [];

function requireText(label, pattern) {
  if (!pattern.test(html)) {
    errors.push(`${target}: missing ${label}`);
  }
}

if (!html) {
  errors.push(`${target}: file is missing or empty`);
}

for (const id of [
  'source-links',
  'tokens',
  'platform-mappings',
  'component-variants',
  'state-matrix',
  'light-dark-rtl-responsive',
  'keyboard-screen-reader',
  'contrast-results',
  'approval',
]) {
  requireText(`section #${id}`, new RegExp(`id=["']${id}["']`));
}

for (const link of [
  'frontend/design-tokens.json',
  'frontend/src/styles/tokens.css',
  'android/app/src/main/kotlin/com/menumaker/ui/theme/',
  'ios/MenuMaker/Shared/Theme/ColorTheme.swift',
]) {
  requireText(`source link ${link}`, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

for (const term of [
  'non-redesign',
  'Mobbin/Figma research is not needed',
  'Default',
  'Loading',
  'Empty',
  'Error',
  'Disabled',
  'Success',
  'Offline/pending',
  'RTL',
  'Dynamic Type',
  'VoiceOver/TalkBack',
  '44px/48dp/44pt',
  'KPI, filter, chart, table, tooltip, and legend',
  '4.5:1',
  '3:1',
  'Approval or feedback is required',
]) {
  requireText(`review evidence "${term}"`, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

if (/<img\b/i.test(html)) {
  const missingAlt = [...html.matchAll(/<img\b[^>]*>/gi)].filter(([tag]) => !/\balt=/i.test(tag));
  if (missingAlt.length) errors.push(`${target}: images must have alt text`);
}

if (/TODO|PLACEHOLDER|TBD/i.test(html)) {
  errors.push(`${target}: placeholder text is not allowed`);
}

if (errors.length) {
  console.error(errors.map((error) => `❌ ${error}`).join('\n'));
  process.exit(1);
}

console.log(`✅ review artifact valid: ${path.relative(process.cwd(), target)}`);
