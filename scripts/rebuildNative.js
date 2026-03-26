const path = require('path');
const fs = require('fs');
const { rebuild } = require('@electron/rebuild');
const packageJson = require('../package.json');

const root = path.resolve(__dirname, '..');

function getElectronVersion() {
  const version =
    packageJson.dependencies?.electron || packageJson.devDependencies?.electron;

  return String(version || '').replace(/^[^\d]*/, '');
}

async function rebuildNative() {
  try {
    await rebuild({
      buildPath: root,
      electronVersion: getElectronVersion(),
      force: true,
      onlyModules: ['better-sqlite3']
    });
  } catch (error) {
    const nativeBinaryPath = path.join(
      root,
      'node_modules',
      'better-sqlite3',
      'build',
      'Release',
      'better_sqlite3.node'
    );
    if (fs.existsSync(nativeBinaryPath)) {
      console.warn(
        'Native rebuild skipped because better_sqlite3.node is already present; reusing the existing Electron build.'
      );
      return;
    }

    throw error;
  }
}

if (require.main === module) {
  rebuildNative().catch((error) => {
    console.error('Native rebuild failed:', error);
    process.exit(1);
  });
}

module.exports = {
  rebuildNative
};
