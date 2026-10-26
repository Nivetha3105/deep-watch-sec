import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, '..', 'network intrusion', 'backend');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('🚀 Starting Network Intrusion Backend & Deep Watch Sec Frontend...\n');

const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: backendDir,
  stdio: 'pipe',
  shell: true,
});

const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'pipe',
  shell: true,
});

function pipeOutput(child, prefix, colorCode) {
  const reset = '\x1b[0m';
  const prefixColored = `${colorCode}[${prefix}]${reset} `;

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${prefixColored}${line}`);
      }
    }
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.error(`${prefixColored}${line}`);
      }
    }
  });
}

// Cyan for backend, Green for frontend
pipeOutput(backend, 'Backend ', '\x1b[36m');
pipeOutput(frontend, 'Frontend', '\x1b[32m');

function cleanup() {
  console.log('\n🛑 Shutting down both services...');
  if (isWindows) {
    if (backend.pid) spawn('taskkill', ['/pid', String(backend.pid), '/T', '/F']);
    if (frontend.pid) spawn('taskkill', ['/pid', String(frontend.pid), '/T', '/F']);
  } else {
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
  }
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
