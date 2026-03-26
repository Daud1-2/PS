const path = require('path');
const { build, Platform } = require('electron-builder');
const { rebuildNative } = require('./rebuildNative');
const { buildRenderer } = require('./buildRenderer');

const root = path.resolve(__dirname, '..');

async function buildInstaller() {
  process.chdir(root);
  await rebuildNative();
  await buildRenderer();

  await build({
    projectDir: root,
    targets: Platform.WINDOWS.createTarget(['nsis']),
    publish: 'never'
  });
}

if (require.main === module) {
  buildInstaller().catch((error) => {
    console.error('Windows installer build failed:', error);
    process.exit(1);
  });
}

module.exports = {
  buildInstaller
};
