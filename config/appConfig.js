const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./loadEnv');

loadEnv();

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getElectronApp() {
  try {
    return require('electron').app;
  } catch (_error) {
    return null;
  }
}

function getUserConfigPath() {
  const electronApp = getElectronApp();

  if (!electronApp || !electronApp.isReady()) {
    return null;
  }

  return path.join(electronApp.getPath('userData'), 'app-config.json');
}

function sanitizeConfig(rawConfig = {}) {
  return {
    appId: String(rawConfig.appId || '').trim() || 'com.grocery.pos',
    productName: String(rawConfig.productName || '').trim() || 'Grocery POS',
    storeName: String(rawConfig.storeName || '').trim() || 'Grocery POS',
    storeId: String(rawConfig.storeId || '').trim() || 'default-store',
    receiptFooterMessage:
      String(rawConfig.receiptFooterMessage || '').trim() ||
      'Thank you for your purchase',
    backendApiUrl: String(rawConfig.backendApiUrl || '').trim(),
    adminApiBaseUrl: String(rawConfig.adminApiBaseUrl || '').trim(),
    autoStartEnabled: parseBoolean(rawConfig.autoStartEnabled, false),
    logLevel: String(rawConfig.logLevel || '').trim().toLowerCase() || 'info',
    windowTitle:
      String(rawConfig.windowTitle || '').trim() ||
      `${String(rawConfig.storeName || '').trim() || 'Grocery POS'} | ${
        String(rawConfig.productName || '').trim() || 'Grocery POS'
      }`
  };
}

function getDefaultConfig() {
  return sanitizeConfig({
    appId: process.env.APP_ID,
    productName: process.env.APP_PRODUCT_NAME || process.env.APP_NAME,
    storeName: process.env.STORE_NAME,
    storeId: process.env.STORE_ID,
    receiptFooterMessage: process.env.RECEIPT_FOOTER_MESSAGE,
    backendApiUrl: process.env.BACKEND_API_URL,
    adminApiBaseUrl: process.env.ADMIN_API_BASE_URL,
    autoStartEnabled: process.env.AUTO_START_ENABLED,
    logLevel: process.env.LOG_LEVEL,
    windowTitle: process.env.WINDOW_TITLE
  });
}

function readUserConfig() {
  const filePath = getUserConfigPath();

  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return {};
  }
}

function getAppConfig() {
  const defaults = getDefaultConfig();
  const persisted = sanitizeConfig(readUserConfig());

  return sanitizeConfig({
    ...defaults,
    ...persisted
  });
}

function ensureUserConfigFile() {
  const filePath = getUserConfigPath();

  if (!filePath) {
    return null;
  }

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(getDefaultConfig(), null, 2)}\n`,
      'utf8'
    );
  }

  return filePath;
}

module.exports = {
  parseBoolean,
  getAppConfig,
  ensureUserConfigFile
};
