const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../config/loadEnv');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { PosPrinter } = require('electron-pos-printer');
const { getAppConfig, ensureUserConfigFile } = require('../config/appConfig');
const { initializeDatabase } = require('../database/db');
const { getLogFilePath, logError, logInfo } = require('./logger');
const {
  startBackupService,
  stopBackupService,
  createManualBackup
} = require('./backupService');
const {
  saveCartState,
  loadCartState,
  clearCartState
} = require('./cartStateService');
const {
  startSyncService,
  stopSyncService,
  runProductSyncNow
} = require('./syncService');
const {
  getProductByBarcode,
  searchProducts
} = require('../services/productService');
const { createSale } = require('../services/saleService');

loadEnv();

const DEV_SERVER_URL = 'http://127.0.0.1:5173';
let appConfig = getAppConfig();
let mainWindow;

function isIgnorableMainProcessError(error) {
  return error?.code === 'EPIPE';
}

function safeMainProcessErrorLog(...args) {
  logError(args[0], args[1]);
}

process.on('uncaughtException', (error) => {
  if (isIgnorableMainProcessError(error)) {
    return;
  }

  safeMainProcessErrorLog('Unhandled main process exception:', error);
});

process.on('unhandledRejection', (reason) => {
  if (isIgnorableMainProcessError(reason)) {
    return;
  }

  safeMainProcessErrorLog('Unhandled main process rejection:', reason);
});

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function getAppIconPath() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icons', 'grocery-pos.ico')
    : path.join(__dirname, '..', 'build', 'icons', 'grocery-pos.ico');

  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function configureProductionWindow(mainBrowserWindow) {
  if (!app.isPackaged) {
    return;
  }

  Menu.setApplicationMenu(null);
  mainBrowserWindow.removeMenu();
  mainBrowserWindow.webContents.on('devtools-opened', () => {
    mainBrowserWindow.webContents.closeDevTools();
  });
  mainBrowserWindow.webContents.on('before-input-event', (event, input) => {
    const key = String(input.key || '').toLowerCase();
    const isDevtoolsShortcut =
      key === 'f12' ||
      (input.control && input.shift && ['i', 'j', 'c'].includes(key));
    const isReloadShortcut = key === 'f5' || (input.control && key === 'r');

    if (isDevtoolsShortcut || isReloadShortcut) {
      event.preventDefault();
    }
  });
}

function formatReceiptDateTime(dateTime) {
  return new Date(dateTime).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildReceiptPrintData(receipt) {
  return [
    {
      type: 'text',
      value: receipt.storeName,
      style: {
        textAlign: 'center',
        fontWeight: '700',
        fontSize: '20px',
        margin: '0 0 6px 0'
      }
    },
    {
      type: 'text',
      value: formatReceiptDateTime(receipt.dateTime),
      style: {
        textAlign: 'center',
        fontSize: '12px',
        color: '#4b5563',
        margin: '0 0 12px 0'
      }
    },
    {
      type: 'table',
      tableHeader: ['Item', 'Qty', 'Price', 'Total'],
      tableBody: receipt.items.map((item) => [
        item.name,
        String(item.qty),
        formatCurrency(item.price),
        formatCurrency(item.total)
      ]),
      tableHeaderStyle: {
        fontWeight: '700',
        borderBottom: '1px solid #111827',
        fontSize: '11px'
      },
      tableBodyStyle: {
        borderBottom: '1px solid #e5e7eb',
        fontSize: '10px'
      },
      style: {
        margin: '0 0 12px 0'
      }
    },
    {
      type: 'text',
      value: `TOTAL: ${formatCurrency(receipt.totalAmount)}`,
      style: {
        textAlign: 'right',
        fontWeight: '700',
        fontSize: '18px',
        margin: '10px 0 12px 0'
      }
    },
    {
      type: 'text',
      value: receipt.footerMessage || 'Thank you',
      style: {
        textAlign: 'center',
        fontSize: '12px',
        color: '#4b5563',
        margin: '12px 0 0 0'
      }
    }
  ];
}

async function printReceipt(receipt) {
  if (!receipt || !Array.isArray(receipt.items) || receipt.items.length === 0) {
    throw new Error('Receipt data is invalid.');
  }

  const activeWindow =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : BrowserWindow.getAllWindows()[0];

  if (!activeWindow) {
    throw new Error('Unable to access a printer window context.');
  }

  const printers = await activeWindow.webContents.getPrintersAsync();

  if (!Array.isArray(printers) || printers.length === 0) {
    throw new Error(
      'No printer connected. Check the thermal printer and try again.'
    );
  }

  try {
    await PosPrinter.print(buildReceiptPrintData(receipt), {
      preview: false,
      silent: true,
      copies: 1,
      margin: '0 0 0 0',
      timeOutPerLine: 250,
      pageSize: '80mm'
    });

    return { printed: true };
  } catch (error) {
    logError('Receipt printing failed.', error);
    throw new Error('Receipt printing failed. Check the printer and try again.');
  }
}

function registerIpcHandlers() {
  ipcMain.handle('products:get-by-barcode', async (_event, barcode) => {
    return getProductByBarcode(barcode);
  });

  ipcMain.handle('products:search', async (_event, query) => {
    return searchProducts(query);
  });

  ipcMain.handle('sales:checkout', async (_event, cartItems) => {
    return createSale(cartItems);
  });

  ipcMain.handle('printer:print-receipt', async (_event, receipt) => {
    return printReceipt(receipt);
  });

  ipcMain.handle('backup:create', async () => {
    return createManualBackup();
  });

  ipcMain.handle('cart-state:save', async (_event, state) => {
    return saveCartState(state);
  });

  ipcMain.handle('cart-state:load', async () => {
    return loadCartState();
  });

  ipcMain.handle('cart-state:clear', async () => {
    return clearCartState();
  });

  ipcMain.handle('sync:refresh-products', async () => {
    return runProductSyncNow();
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: appConfig.windowTitle,
    icon: getAppIconPath(),
    backgroundColor: '#f4f1e8',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  configureProductionWindow(mainWindow);

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    mainWindow.setTitle(appConfig.windowTitle);
    return mainWindow;
  }

  await mainWindow.loadURL(DEV_SERVER_URL);
  mainWindow.setTitle(appConfig.windowTitle);
  return mainWindow;
}

app
  .whenReady()
  .then(async () => {
    ensureUserConfigFile();
    appConfig = getAppConfig();
    app.setAppUserModelId(appConfig.appId);
    app.setName(appConfig.productName);

    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: appConfig.autoStartEnabled,
        path: process.execPath
      });
    }

    initializeDatabase(app.getPath('userData'));
    registerIpcHandlers();
    startBackupService();
    startSyncService();
    await createMainWindow();
    logInfo('Application startup complete.', {
      logFilePath: getLogFilePath()
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow();
      }
    });
  })
  .catch((error) => {
    logError('Electron startup failed.', error);
    app.exit(1);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackupService();
    stopSyncService();
    app.quit();
  }
});
