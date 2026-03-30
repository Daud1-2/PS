const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDatabase } = require('../database/db');
const { createManualBackup } = require('./backupService');

function getStateFilePaths() {
  const userDataPath = app.getPath('userData');

  return [
    path.join(userDataPath, 'cart-state.json'),
    path.join(userDataPath, 'held-sale-state.json'),
    path.join(userDataPath, 'sync-state.json')
  ];
}

async function clearStateFiles() {
  const clearedFiles = [];

  for (const filePath of getStateFilePaths()) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    await fs.promises.unlink(filePath);
    clearedFiles.push(filePath);
  }

  return clearedFiles;
}

async function resetBusinessData() {
  const backup = await createManualBackup();
  const db = getDatabase();

  const before = {
    sales: Number(db.prepare('SELECT COUNT(*) AS total FROM sales').get().total || 0),
    saleItems: Number(
      db.prepare('SELECT COUNT(*) AS total FROM sale_items').get().total || 0
    ),
    shifts: Number(db.prepare('SELECT COUNT(*) AS total FROM shifts').get().total || 0),
    products: Number(db.prepare('SELECT COUNT(*) AS total FROM products').get().total || 0)
  };

  const resetTransaction = db.transaction(() => {
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM shifts').run();
    db.prepare(
      "DELETE FROM sqlite_sequence WHERE name IN ('sales', 'sale_items', 'shifts')"
    ).run();
  });

  resetTransaction();

  const clearedFiles = await clearStateFiles();

  return {
    reset: true,
    backupPath: backup.path,
    clearedFiles,
    before,
    after: {
      sales: Number(db.prepare('SELECT COUNT(*) AS total FROM sales').get().total || 0),
      saleItems: Number(
        db.prepare('SELECT COUNT(*) AS total FROM sale_items').get().total || 0
      ),
      shifts: Number(db.prepare('SELECT COUNT(*) AS total FROM shifts').get().total || 0),
      products: Number(db.prepare('SELECT COUNT(*) AS total FROM products').get().total || 0)
    }
  };
}

module.exports = {
  resetBusinessData
};
