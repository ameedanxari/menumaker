#!/usr/bin/env node
import { spawn } from 'child_process';
import process from 'process';

const cmd = process.argv.slice(2).join(' ');

if (!cmd) {
  console.error('Usage: node shared/fake-backend/run-with-server.js "<command to run after server starts>"');
  process.exit(1);
}

const env = { ...process.env };
const port = env.FAKE_BACKEND_PORT || '4000';

console.log(`[fake-backend] starting on port ${port}...`);

const server = spawn('node', ['shared/fake-backend/server.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env
});

let testProcess = null;
let serverReady = false;

function cleanup(code = 0) {
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
    serverReady = true;
    console.log(`[fake-backend] running; executing: ${cmd}`);
    testProcess = spawn(cmd, {
      shell: true,
      stdio: 'inherit',
      env
    });

    testProcess.on('exit', (code) => {
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
