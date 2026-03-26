const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const child = spawn(process.execPath, [vite], {
  cwd: root,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

