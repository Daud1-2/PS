const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const entryPoint = path.join(root, 'renderer', 'AdminDashboard', 'main.jsx');
const outputPath = path.join(root, 'backend', 'generated', 'admin-app.js');

async function buildAdminBundle() {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [entryPoint],
    outfile: outputPath,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120', 'safari16'],
    jsx: 'automatic',
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx'
    }
  });
}

if (require.main === module) {
  buildAdminBundle().catch((error) => {
    console.error('Admin bundle build failed:', error);
    process.exit(1);
  });
}

module.exports = {
  buildAdminBundle,
  outputPath
};
