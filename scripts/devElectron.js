const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const waitOn = path.join(root, 'node_modules', 'wait-on', 'bin', 'wait-on');
const electron = path.join(
  root,
  'node_modules',
  'electron',
  'dist',
  'electron.exe'
);

const wait = spawnSync(process.execPath, [waitOn, 'http://127.0.0.1:5173'], {
  cwd: root,
  stdio: 'inherit'
});

if (wait.status !== 0) {
  process.exit(wait.status || 1);
}

const child = spawn(electron, [root], {
  cwd: root,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

