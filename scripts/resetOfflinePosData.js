const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function getAppDataPath() {
  const appData = process.env.APPDATA;

  if (!appData) {
    throw new Error('APPDATA is not available.');
  }

  return appData;
}

function getTargetDirectories() {
  const appData = getAppDataPath();
  const candidates = [
    path.join(appData, 'Electron'),
    path.join(appData, 'offline-pos-foundation'),
    path.join(appData, 'Grocery POS')
  ];

  return candidates.filter((directoryPath, index, list) => {
    return list.indexOf(directoryPath) === index && fs.existsSync(directoryPath);
  });
}

function resetDatabase(databasePath) {
  const db = new Database(databasePath);

  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = OFF');

    const resetTransaction = db.transaction(() => {
      db.prepare('DELETE FROM sale_items').run();
      db.prepare('DELETE FROM sales').run();
      db.prepare('DELETE FROM shifts').run();
      db.prepare(
        `
          UPDATE products
          SET
            cost_price = NULL,
            selling_price = NULL,
            stock = 0,
            cloud_product_id = NULL,
            stock_updated_at = CURRENT_TIMESTAMP
        `
      ).run();
      db.prepare(
        "DELETE FROM sqlite_sequence WHERE name IN ('sales', 'sale_items', 'shifts')"
      ).run();
    });

    resetTransaction();
    db.pragma('foreign_keys = ON');

    return {
      databasePath,
      products: db.prepare('SELECT COUNT(*) AS total FROM products').get().total,
      sales: db.prepare('SELECT COUNT(*) AS total FROM sales').get().total,
      shifts: db.prepare('SELECT COUNT(*) AS total FROM shifts').get().total
    };
  } finally {
    db.close();
  }
}

function clearStateFiles(directoryPath) {
  const fileNames = [
    'cart-state.json',
    'held-sale-state.json',
    'sync-state.json'
  ];

  const clearedFiles = [];

  for (const fileName of fileNames) {
    const filePath = path.join(directoryPath, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    fs.unlinkSync(filePath);
    clearedFiles.push(filePath);
  }

  return clearedFiles;
}

function main() {
  const directories = getTargetDirectories();

  if (directories.length === 0) {
    throw new Error('No Offline POS user-data directories were found.');
  }

  const databaseResults = [];
  const clearedFiles = [];

  for (const directoryPath of directories) {
    const databasePath = path.join(directoryPath, 'offline-pos.sqlite');

    if (fs.existsSync(databasePath)) {
      databaseResults.push(resetDatabase(databasePath));
    }

    clearedFiles.push(...clearStateFiles(directoryPath));
  }

  console.log(
    JSON.stringify(
      {
        reset: true,
        databases: databaseResults,
        clearedFiles
      },
      null,
      2
    )
  );
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
