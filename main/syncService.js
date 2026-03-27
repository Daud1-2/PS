const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { logInfo, logWarn, logError } = require('./logger');
const {
  getPendingSalesForSync,
  markSaleSynced
} = require('../services/saleService');
const { getShiftsForSync } = require('../services/shiftService');
const {
  getProductsForSync,
  applyCloudProducts
} = require('../services/productService');

const INSECURE_API_KEYS = new Set([
  '',
  'change-me-before-production',
  'dev-api-key-change-me'
]);

const DEFAULT_SALES_INTERVAL_MS = 15000;
const DEFAULT_PRODUCT_INTERVAL_MS = 180000;
const MAX_SYNC_INTERVAL_MS = 300000;

const syncLoops = {
  sales: {
    timer: null,
    isRunning: false,
    failureCount: 0,
    activePromise: null
  },
  products: {
    timer: null,
    isRunning: false,
    failureCount: 0,
    activePromise: null
  }
};

let hasLoggedMissingConfig = false;
let syncState = {
  productsCursor: null
};

function safeLog(method, ...args) {
  try {
    const [message, metadata] = args;

    if (method === 'error') {
      logError(message, metadata);
      return;
    }

    if (method === 'warn') {
      logWarn(message, metadata);
      return;
    }

    logInfo(message, metadata);
  } catch (error) {
    if (error?.code !== 'EPIPE') {
      throw error;
    }
  }
}

function getSyncStatePath() {
  return path.join(app.getPath('userData'), 'sync-state.json');
}

function loadSyncState() {
  try {
    const filePath = getSyncStatePath();

    if (!fs.existsSync(filePath)) {
      return;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(fileContents);

    syncState = {
      productsCursor: parsed?.productsCursor || null
    };
  } catch (error) {
    safeLog('error', 'Sync service: unable to read sync state.', error);
  }
}

function persistSyncState() {
  try {
    fs.writeFileSync(getSyncStatePath(), JSON.stringify(syncState), 'utf8');
  } catch (error) {
    safeLog('error', 'Sync service: unable to persist sync state.', error);
  }
}

function getConfig() {
  const apiKey = String(process.env.ADMIN_API_KEY || '').trim();

  return {
    apiBaseUrl: String(process.env.BACKEND_API_URL || '').trim(),
    apiKey: INSECURE_API_KEYS.has(apiKey) ? '' : apiKey,
    salesIntervalMs:
      Number(process.env.SYNC_INTERVAL_MS) || DEFAULT_SALES_INTERVAL_MS,
    productIntervalMs:
      Number(process.env.PRODUCT_SYNC_INTERVAL_MS) || DEFAULT_PRODUCT_INTERVAL_MS
  };
}

function getBackoffDelay(loopName) {
  const config = getConfig();
  const baseInterval =
    loopName === 'products' ? config.productIntervalMs : config.salesIntervalMs;

  return Math.min(
    baseInterval * 2 ** syncLoops[loopName].failureCount,
    MAX_SYNC_INTERVAL_MS
  );
}

function scheduleNextRun(loopName, delayMs) {
  if (syncLoops[loopName].timer) {
    clearTimeout(syncLoops[loopName].timer);
  }

  syncLoops[loopName].timer = setTimeout(() => {
    runLoop(loopName).catch((error) => {
      safeLog('error', `Sync service: ${loopName} loop crashed.`, error);
    });
  }, delayMs);
}

async function checkConnectivity(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`Connectivity check failed with ${response.status}.`);
  }
}

async function uploadPendingSales(apiBaseUrl, apiKey) {
  const pendingSales = getPendingSalesForSync(50);

  if (pendingSales.length === 0) {
    return 0;
  }

  const response = await fetch(`${apiBaseUrl}/sync/sales`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      sales: pendingSales
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Sync upload failed with ${response.status}: ${errorText || 'Unknown error'}`
    );
  }

  const payload = await response.json();
  const syncedSales = Array.isArray(payload.syncedSales)
    ? payload.syncedSales
    : pendingSales.map((sale) => ({
        saleId: sale.sale.saleId,
        syncedAt: new Date().toISOString()
      }));

  for (const sale of syncedSales) {
    if (sale?.saleId) {
      markSaleSynced(sale.saleId, sale.syncedAt || new Date().toISOString());
    }
  }

  return syncedSales.length;
}

async function uploadShifts(apiBaseUrl, apiKey) {
  const shifts = getShiftsForSync(250);

  if (shifts.length === 0) {
    return 0;
  }

  const response = await fetch(`${apiBaseUrl}/sync/shifts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      shifts
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Shift sync failed with ${response.status}: ${errorText || 'Unknown error'}`
    );
  }

  const payload = await response.json();
  return Array.isArray(payload.syncedShifts) ? payload.syncedShifts.length : shifts.length;
}

async function uploadLocalProducts(apiBaseUrl, apiKey) {
  const products = getProductsForSync(500);

  if (products.length === 0) {
    return 0;
  }

  const response = await fetch(`${apiBaseUrl}/sync/products`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      products
    }),
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Product upload failed with ${response.status}: ${errorText || 'Unknown error'}`
    );
  }

  const payload = await response.json();
  applyCloudProducts(payload.products || []);

  return Array.isArray(payload.products) ? payload.products.length : 0;
}

async function pullCloudProducts(apiBaseUrl, apiKey) {
  const params = new URLSearchParams();

  if (syncState.productsCursor) {
    params.set('updatedSince', syncState.productsCursor);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/products${suffix}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Product pull failed with ${response.status}: ${errorText || 'Unknown error'}`
    );
  }

  const payload = await response.json();
  applyCloudProducts(payload.products || []);

  if (payload.serverTime) {
    syncState.productsCursor = payload.serverTime;
    persistSyncState();
  }

  return Array.isArray(payload.products) ? payload.products.length : 0;
}

async function runSalesLoop(apiBaseUrl, apiKey) {
  const syncedCount = await uploadPendingSales(apiBaseUrl, apiKey);
  const syncedShiftCount = await uploadShifts(apiBaseUrl, apiKey);

  if (syncedCount > 0) {
    safeLog('info', `Sync service: uploaded ${syncedCount} sale(s).`);
  }

  if (syncedShiftCount > 0) {
    safeLog('info', `Sync service: uploaded ${syncedShiftCount} shift record(s).`);
  }

  return {
    syncedCount,
    syncedShiftCount
  };
}

async function runProductsLoop(apiBaseUrl, apiKey) {
  let uploadedCount = 0;
  let pulledCount = 0;
  let uploadError = null;
  let pullError = null;

  try {
    uploadedCount = await uploadLocalProducts(apiBaseUrl, apiKey);
  } catch (error) {
    uploadError = error;
    safeLog('warn', 'Sync service: product upload skipped due to error.', error);
  }

  try {
    pulledCount = await pullCloudProducts(apiBaseUrl, apiKey);
  } catch (error) {
    pullError = error;
    safeLog('warn', 'Sync service: product pull failed.', error);
  }

  if (uploadedCount > 0 || pulledCount > 0) {
    safeLog(
      'info',
      `Sync service: uploaded ${uploadedCount} product(s), pulled ${pulledCount} product(s).`
    );
  }

  if (pullError) {
    throw pullError;
  }

  if (uploadError && pulledCount === 0) {
    throw uploadError;
  }

  return {
    uploadedCount,
    pulledCount
  };
}

async function runLoop(loopName) {
  const loop = syncLoops[loopName];

  if (loop.isRunning) {
    return loop.activePromise;
  }

  const config = getConfig();

  if (!config.apiBaseUrl || !config.apiKey) {
    if (!hasLoggedMissingConfig) {
      safeLog(
        'warn',
        'Sync service: BACKEND_API_URL or ADMIN_API_KEY missing, sync is idle.'
      );
      hasLoggedMissingConfig = true;
    }

    scheduleNextRun(
      loopName,
      loopName === 'products' ? DEFAULT_PRODUCT_INTERVAL_MS : DEFAULT_SALES_INTERVAL_MS
    );
    return;
  }

  hasLoggedMissingConfig = false;
  loop.isRunning = true;
  loop.activePromise = (async () => {
    try {
      await checkConnectivity(config.apiBaseUrl);

      const result =
        loopName === 'products'
          ? await runProductsLoop(config.apiBaseUrl, config.apiKey)
          : await runSalesLoop(config.apiBaseUrl, config.apiKey);

      loop.failureCount = 0;
      scheduleNextRun(
        loopName,
        loopName === 'products' ? config.productIntervalMs : config.salesIntervalMs
      );

      return result;
    } catch (error) {
      loop.failureCount += 1;
      safeLog('error', `Sync service failure (${loopName}):`, error);
      scheduleNextRun(loopName, getBackoffDelay(loopName));
      throw error;
    } finally {
      loop.isRunning = false;
      loop.activePromise = null;
    }
  })();

  return loop.activePromise;
}

function startSyncService() {
  loadSyncState();
  scheduleNextRun('sales', 1000);
  scheduleNextRun('products', 3000);
}

function stopSyncService() {
  for (const loopName of Object.keys(syncLoops)) {
    if (syncLoops[loopName].timer) {
      clearTimeout(syncLoops[loopName].timer);
      syncLoops[loopName].timer = null;
    }
  }
}

module.exports = {
  startSyncService,
  stopSyncService,
  runProductSyncNow() {
    return runLoop('products');
  }
};
