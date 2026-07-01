#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const tokenPath = path.resolve(process.cwd(), process.argv[2] || 'frontend/design-tokens.json');
const errors = [];

function fail(message) {
  errors.push(`${tokenPath}: ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`invalid JSON: ${error.message}`);
    return {};
  }
}

function get(obj, dotted) {
  return dotted.split('.').reduce((current, key) => current?.[key], obj);
}

function primitiveValue(tokens, ref) {
  const normalized = ref.replace(/^\{|\}$/g, '');
  if (normalized.startsWith('color.')) {
    return get(tokens.primitives, normalized);
  }
  if (normalized.startsWith('semantic.')) {
    return resolveValue(tokens, get(tokens, normalized), new Set([normalized]));
  }
  return get(tokens.primitives, normalized);
}

function resolveValue(tokens, value, seen = new Set()) {
  if (typeof value !== 'string') {
    return value;
  }
  const match = value.match(/^\{([^}]+)\}$/);
  if (!match) {
    return value;
  }
  const ref = match[1];
  if (seen.has(ref)) {
    fail(`cyclic token reference: ${[...seen, ref].join(' -> ')}`);
    return undefined;
  }
  const resolved = primitiveValue(tokens, ref);
  if (resolved === undefined) {
    fail(`missing token reference: ${value}`);
    return undefined;
  }
  return resolveValue(tokens, resolved, new Set([...seen, ref]));
}

function walkRefs(tokens, node, trail = []) {
  if (!node || typeof node !== 'object') {
    if (typeof node === 'string' && node.startsWith('{')) {
      resolveValue(tokens, node, new Set(trail));
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    walkRefs(tokens, value, [...trail, key]);
  }
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) {
    return null;
  }
  const int = parseInt(clean, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function luminance({ r, g, b }) {
  const channel = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

function contrast(fg, bg) {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) {
    return 0;
  }
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const tokens = readJson(tokenPath);
const requiredTopLevel = ['schema_version', 'brand', 'metadata', 'primitives', 'semantic', 'components', 'states'];
for (const key of requiredTopLevel) {
  if (!tokens[key]) fail(`missing top-level key "${key}"`);
}

const requiredPrimitiveGroups = ['color', 'typography', 'spacing', 'radius', 'elevation', 'motion', 'breakpoint', 'focus'];
for (const key of requiredPrimitiveGroups) {
  if (!tokens.primitives?.[key]) fail(`missing primitive group "${key}"`);
}

const requiredThemes = ['light', 'dark'];
const requiredSemanticGroups = ['background', 'text', 'border', 'action', 'state'];
for (const theme of requiredThemes) {
  for (const group of requiredSemanticGroups) {
    if (!tokens.semantic?.[theme]?.[group]) {
      fail(`missing semantic.${theme}.${group}`);
    }
  }
}

const requiredStates = ['default', 'loading', 'empty', 'error', 'disabled', 'success', 'offline', 'pending'];
for (const state of requiredStates) {
  if (!tokens.states?.[state]) fail(`missing UI state role "${state}"`);
}

const requiredComponents = ['button', 'field', 'card', 'modal', 'table', 'feedback'];
for (const component of requiredComponents) {
  if (!tokens.components?.[component]) fail(`missing component token contract "${component}"`);
}

walkRefs(tokens, tokens.semantic);
walkRefs(tokens, tokens.components);

const pairs = [
  ['light text.primary on canvas', 'semantic.light.text.primary', 'semantic.light.background.canvas', 4.5],
  ['light text.secondary on surface', 'semantic.light.text.secondary', 'semantic.light.background.surface', 4.5],
  ['light action.primary text', 'semantic.light.text.on_brand', 'semantic.light.action.primary', 4.5],
  ['light error text', 'semantic.light.state.error_fg', 'semantic.light.state.error_bg', 4.5],
  ['light success text', 'semantic.light.state.success_fg', 'semantic.light.state.success_bg', 4.5],
  ['dark text.primary on canvas', 'semantic.dark.text.primary', 'semantic.dark.background.canvas', 4.5],
  ['dark text.secondary on surface', 'semantic.dark.text.secondary', 'semantic.dark.background.surface', 4.5],
  ['dark action.primary UI', 'semantic.dark.text.on_brand', 'semantic.dark.action.primary', 3],
  ['dark error text', 'semantic.dark.state.error_fg', 'semantic.dark.state.error_bg', 4.5],
  ['dark success text', 'semantic.dark.state.success_fg', 'semantic.dark.state.success_bg', 4.5],
];

for (const [label, fgPath, bgPath, minimum] of pairs) {
  const fg = resolveValue(tokens, `{${fgPath}}`);
  const bg = resolveValue(tokens, `{${bgPath}}`);
  const ratio = contrast(fg, bg);
  if (ratio < minimum) {
    fail(`contrast ${label} is ${ratio.toFixed(2)}:1, expected >= ${minimum}:1 (${fg} on ${bg})`);
  }
}

for (const output of tokens.metadata?.generated_outputs ?? []) {
  if (!output.includes('/')) {
    fail(`generated output path is not explicit: ${output}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `❌ ${error}`).join('\n'));
  process.exit(1);
}

console.log(`✅ token schema valid: ${path.relative(process.cwd(), tokenPath)}`);
