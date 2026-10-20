import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';
const python = resolve('ml-service', '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error('Create ml-service/.venv, install requirements and train the model first. See README.');
  process.exit(1);
}
const processes = [
  spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd: 'ml-service', stdio: 'inherit' }),
  spawn(npm, ['run', 'dev'], { cwd: 'backend', stdio: 'inherit', shell: windows }),
  spawn(npm, ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '3001'], { cwd: 'frontend', stdio: 'inherit', shell: windows }),
];
let stopping = false;
function stop(code = 0) { if(stopping)return; stopping = true; processes.forEach(p => p.kill('SIGTERM')); process.exitCode=code; }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
processes.forEach(p => { p.on('error', e => {console.error(e);stop(1)}); p.on('exit', code => {if(!stopping)stop(code || 1)}); });
