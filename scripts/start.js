const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const children = [];

function startScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const child = spawn(process.execPath, [scriptPath], {
    cwd: root,
    stdio: 'inherit'
  });

  children.push(child);

  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });

  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => process.exit(code), 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startScript('devRenderer.js');
startScript('devElectron.js');

