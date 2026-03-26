const path = require('path');
const { loadEnv } = require('../config/loadEnv');
const express = require('express');
const cors = require('cors');
const esbuild = require('esbuild');

loadEnv();

const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const productsRoutes = require('./routes/products');
const { ensureCloudSchema, hasDatabaseConfig } = require('./db');
const { requireApiKey } = require('./middleware/auth');

const app = express();
const port = Number(process.env.BACKEND_PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const protectedPrefixes = ['/sync', '/sales', '/inventory', '/products'];

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    databaseConfigured: hasDatabaseConfig(),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (_req, res) => {
  res.redirect('/admin');
});

app.use((req, res, next) => {
  const requiresAuth = protectedPrefixes.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
  );

  if (!requiresAuth) {
    next();
    return;
  }

  requireApiKey(req, res, next);
});

app.use(salesRoutes);
app.use(inventoryRoutes);
app.use(productsRoutes);

function buildAdminHtml() {
  const adminConfig = {
    apiBaseUrl: process.env.ADMIN_API_BASE_URL || '',
    refreshMs: Number(process.env.ADMIN_REFRESH_MS) || 45000
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%232457c5'/%3E%3Ctext x='50%25' y='56%25' text-anchor='middle' font-size='28' fill='white' font-family='Segoe UI, Arial, sans-serif'%3EA%3C/text%3E%3C/svg%3E"
    />
    <title>POS Admin Dashboard</title>
  </head>
  <body style="margin:0;background:#f4f7fb;">
    <div id="root"></div>
    <script>window.__ADMIN_CONFIG__ = ${JSON.stringify(adminConfig)};</script>
    <script src="/admin/app.js"></script>
  </body>
</html>`;
}

async function bundleAdminApp() {
  const result = await esbuild.build({
    entryPoints: [
      path.join(__dirname, '..', 'renderer', 'AdminDashboard', 'main.jsx')
    ],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120', 'safari16'],
    jsx: 'automatic',
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx'
    }
  });

  return result.outputFiles[0].text;
}

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end();
});

app.get('/admin', (_req, res) => {
  res.type('html').send(buildAdminHtml());
});

app.get('/admin/app.js', async (_req, res, next) => {
  try {
    const bundle = await bundleAdminApp();
    res.type('application/javascript').send(bundle);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('Backend error:', error);
  res.status(500).json({
    error: error.message || 'Internal server error'
  });
});

ensureCloudSchema()
  .then(() => {
    if (!hasDatabaseConfig()) {
      console.warn(
        'Supabase database config is missing. Backend started without database access.'
      );
    }

    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
  });
