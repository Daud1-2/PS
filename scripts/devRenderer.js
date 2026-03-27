const path = require('path');
const { spawn } = require('child_process');
const { canReuseDevServer } = require('./devProcessUtils');

const root = path.resolve(__dirname, '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const devServerUrl = 'http://127.0.0.1:5173';

async function run() {
  if (await canReuseDevServer(devServerUrl)) {
    console.log(`Using existing renderer dev server at ${devServerUrl}`);
    return;
  }

  const child = spawn(process.execPath, [vite], {
    cwd: root,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error('Renderer dev server failed to start:', error);
  process.exit(1);
});
