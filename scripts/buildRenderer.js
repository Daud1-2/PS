const path = require('path');
const fs = require('fs');
const { build } = require('vite');

const root = path.resolve(__dirname, '..');
const distIndexPath = path.join(root, 'dist', 'index.html');

function normalizeDistAssetPaths() {
  if (!fs.existsSync(distIndexPath)) {
    return;
  }

  const currentHtml = fs.readFileSync(distIndexPath, 'utf8');
  const nextHtml = currentHtml
    .replace(/(src|href)="\/assets\//g, '$1="./assets/')
    .replace(/(src|href)='\/assets\//g, "$1='./assets/");

  if (nextHtml !== currentHtml) {
    fs.writeFileSync(distIndexPath, nextHtml, 'utf8');
  }
}

async function buildRenderer() {
  await build({
    root,
    mode: 'production',
    configFile: path.join(root, 'vite.config.js')
  });

  normalizeDistAssetPaths();
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
