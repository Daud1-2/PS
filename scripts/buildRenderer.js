const path = require('path');
const { build } = require('vite');

const root = path.resolve(__dirname, '..');

async function buildRenderer() {
  await build({
    root,
    mode: 'production',
    configFile: path.join(root, 'vite.config.js')
  });
}

if (require.main === module) {
  buildRenderer().catch((error) => {
    console.error('Renderer build failed:', error);
    process.exit(1);
  });
}

module.exports = {
  buildRenderer
};
