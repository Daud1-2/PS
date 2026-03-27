const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');

function canReuseDevServer(url) {
  return new Promise((resolve) => {
    const request = http.get(
      url,
      {
        timeout: 1500
      },
      (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 500);
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });

    request.on('error', () => {
      resolve(false);
    });
  });
}

function stopProjectElectronProcesses(rootDirectory) {
  if (process.platform !== 'win32') {
    return;
  }

  const electronPath = path.join(
    rootDirectory,
    'node_modules',
    'electron',
    'dist',
    'electron.exe'
  );
  const escapedPath = electronPath.replace(/'/g, "''");
  const script = [
    `$target = '${escapedPath}'`,
    "Get-CimInstance Win32_Process -Filter \"name = 'electron.exe'\" |",
    "Where-Object { $_.ExecutablePath -eq $target } |",
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }'
  ].join(' ');

  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      stdio: 'ignore'
    });
  } catch (_error) {
    // Ignore cleanup failures and let the new launch attempt proceed.
  }
}

module.exports = {
  canReuseDevServer,
  stopProjectElectronProcesses
};
