import { spawn } from 'node:child_process';

process.env.DATABASE_PATH = './data/test-e2e.db';
process.env.NEXT_DIST_DIR = '.next-e2e';
process.env.LOGIN_CLIENT_RATE_LIMIT = '500';
process.env.LOGIN_ACCOUNT_RATE_LIMIT = '100';
const { resetDb, closeDb } = await import('../src/lib/db.js');
resetDb();
closeDb();

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(npmCommand, ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3100'], {
  env: process.env,
  stdio: 'inherit'
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  server.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
server.once('error', error => {
  console.error('Unable to start the isolated Playwright server:', error.message);
  process.exitCode = 1;
});
server.once('exit', (code, signal) => {
  if (signal && !stopping) console.error(`Playwright server stopped by ${signal}.`);
  process.exitCode = code ?? (stopping ? 0 : 1);
});
