const path = require('path');
const { app } = require('electron');
const { initializeDatabase } = require('../database/db');
const { getProductsForSync, applyCloudProducts } = require('../services/productService');

const API_BASE_URL = 'https://ps-admin-panel.vercel.app';
const API_KEY = 'admin';
const BATCH_SIZE = 500;
const MAX_BATCHES = 12;

async function uploadBatch(products) {
  const response = await fetch(`${API_BASE_URL}/sync/products`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({ products })
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const userDataPath = path.join(process.env.APPDATA, 'offline-pos-foundation');
  initializeDatabase(userDataPath);

  let uploadedCount = 0;

  for (let batchIndex = 0; batchIndex < MAX_BATCHES; batchIndex += 1) {
    const products = getProductsForSync(BATCH_SIZE);

    if (products.length === 0) {
      break;
    }

    const payload = await uploadBatch(products);
    const syncedProducts = Array.isArray(payload.products) ? payload.products : [];
    applyCloudProducts(syncedProducts);
    uploadedCount += syncedProducts.length;

    console.log(
      `Uploaded batch ${batchIndex + 1}: ${syncedProducts.length} product(s)`
    );

    if (products.length < BATCH_SIZE) {
      break;
    }
  }

  console.log(`Manual product cloud sync complete: ${uploadedCount} product(s) uploaded.`);
  app.quit();
  process.exit(0);
}

app.whenReady().then(main).catch((error) => {
  console.error(error);
  app.quit();
  process.exit(1);
});
