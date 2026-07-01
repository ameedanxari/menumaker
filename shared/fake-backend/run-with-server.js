#!/usr/bin/env node
import { spawn } from 'child_process';
import process from 'process';

const cmd = process.argv.slice(2).join(' ');

if (!cmd) {
  console.error('Usage: node shared/fake-backend/run-with-server.js "<command to run after server starts>"');
  process.exit(1);
}

const env = { ...process.env, FAKE_BACKEND_PORT: process.env.FAKE_BACKEND_PORT || '0' };
const startupTimeoutMs = Number(env.FAKE_BACKEND_STARTUP_TIMEOUT_MS || 15000);
const testTimeoutMs = Number(env.FAKE_BACKEND_TEST_TIMEOUT_MS || 0);
let port = env.FAKE_BACKEND_PORT;

console.log(`[fake-backend] starting on port ${port}...`);

const server = spawn('node', ['shared/fake-backend/server.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env
});

let testProcess = null;
let serverReady = false;
let testTimeout = null;

const startupTimeout = setTimeout(() => {
  if (!serverReady) {
    console.error(`[fake-backend] server did not become healthy within ${startupTimeoutMs}ms`);
    cleanup(124);
  }
}, startupTimeoutMs);

function envForChild(actualPort) {
  const childEnv = { ...env, FAKE_BACKEND_PORT: String(actualPort) };
  const apiBase = childEnv.API_BASE_URL;
  if (apiBase) {
    childEnv.API_BASE_URL = apiBase.replace(/:(\d+)(\/api\/v1\/?)/, `:${actualPort}$2`);
  } else {
    childEnv.API_BASE_URL = `http://127.0.0.1:${actualPort}/api/v1/`;
  }
  return childEnv;
}

function cleanup(code = 0) {
  clearTimeout(startupTimeout);
  if (testTimeout) clearTimeout(testTimeout);
  if (testProcess && !testProcess.killed) {
    testProcess.kill('SIGTERM');
  }
  if (!server.killed) {
    server.kill('SIGTERM');
  }
  process.exit(code);
}

server.stdout.on('data', (data) => {
  const msg = data.toString();
  process.stdout.write(msg);

  if (!serverReady && msg.includes('running on port')) {
    const match = msg.match(/running on port (\d+)/);
    port = match?.[1] || port;
    serverReady = true;
    clearTimeout(startupTimeout);
    console.log(`[fake-backend] running; executing: ${cmd}`);
    testProcess = spawn(cmd, {
      shell: true,
      stdio: 'inherit',
      env: envForChild(port)
    });

    if (testTimeoutMs > 0) {
      testTimeout = setTimeout(() => {
        console.error(`[fake-backend] test command timed out after ${testTimeoutMs}ms`);
        cleanup(124);
      }, testTimeoutMs);
    }

    testProcess.on('exit', (code) => {
      if (testTimeout) clearTimeout(testTimeout);
      console.log(`[fake-backend] test command exited with code ${code}`);
      cleanup(code ?? 0);
    });
  }
});

server.stderr.on('data', (data) => process.stderr.write(data));

server.on('exit', (code) => {
  if (!serverReady) {
    console.error('[fake-backend] server exited before ready', code);
    cleanup(code ?? 1);
  }
});

process.on('SIGINT', () => cleanup(130));
process.on('SIGTERM', () => cleanup(143));
