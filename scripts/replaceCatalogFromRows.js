const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function getRowsFilePath() {
  const rowsFilePath = process.argv[2];

  if (!rowsFilePath) {
    throw new Error('Rows JSON file path is required.');
  }

  const resolvedPath = path.resolve(rowsFilePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Rows JSON file not found: ${resolvedPath}`);
  }

  return resolvedPath;
}

function getTargetDatabasePaths() {
  const appData = process.env.APPDATA;

  if (!appData) {
    throw new Error('APPDATA is not available.');
  }

  const candidates = [
    path.join(appData, 'Electron', 'offline-pos.sqlite'),
    path.join(appData, 'offline-pos-foundation', 'offline-pos.sqlite'),
    path.join(appData, 'Grocery POS', 'offline-pos.sqlite')
  ];

  return candidates.filter((filePath, index, list) => {
    return list.indexOf(filePath) === index && fs.existsSync(filePath);
  });
}

function createProductsTable(db, tableName = 'products') {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_product_id INTEGER,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      cost_price REAL NULL,
      selling_price REAL NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      created_source TEXT NOT NULL DEFAULT 'pos',
      catalog_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      stock_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function ensureProductSchemaSupportsNullableCatalog(db) {
  const columns = db.prepare('PRAGMA table_info(products)').all();
  const costPriceColumn = columns.find((column) => column.name === 'cost_price');
  const sellingPriceColumn = columns.find(
    (column) => column.name === 'selling_price'
  );

  if (!costPriceColumn || !sellingPriceColumn) {
    throw new Error('Products table is missing required catalog columns.');
  }

  if (
    Number(costPriceColumn.notnull) !== 1 &&
    Number(sellingPriceColumn.notnull) !== 1
  ) {
    return;
  }

  const rebuild = db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS products__next');
    createProductsTable(db, 'products__next');

    db.exec(`
      INSERT INTO products__next (
        id,
        cloud_product_id,
        name,
        barcode,
        cost_price,
        selling_price,
        stock,
        created_source,
        catalog_updated_at,
        stock_updated_at,
        archived_at,
        created_at
      )
      SELECT
        id,
        cloud_product_id,
        name,
        barcode,
        cost_price,
        selling_price,
        COALESCE(stock, 0),
        COALESCE(NULLIF(created_source, ''), 'pos'),
        COALESCE(NULLIF(catalog_updated_at, ''), created_at, CURRENT_TIMESTAMP),
        COALESCE(NULLIF(stock_updated_at, ''), created_at, CURRENT_TIMESTAMP),
        archived_at,
        COALESCE(created_at, CURRENT_TIMESTAMP)
      FROM products
    `);

    db.exec('DROP TABLE products');
    db.exec('ALTER TABLE products__next RENAME TO products');
  });

  db.pragma('foreign_keys = OFF');

  try {
    rebuild();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function replaceCatalog(db, rows) {
  const insertProduct = db.prepare(`
    INSERT INTO products (
      name,
      barcode,
      cost_price,
      selling_price,
      stock,
      created_source,
      catalog_updated_at,
      stock_updated_at
    )
    VALUES (
      @name,
      @barcode,
      NULL,
      NULL,
      0,
      'seed',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const replaceTransaction = db.transaction((catalogRows) => {
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM products').run();
    db.prepare(
      "DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_items')"
    ).run();

    for (const row of catalogRows) {
      insertProduct.run(row);
    }
  });

  replaceTransaction(rows);
}

function main() {
  const rowsFilePath = getRowsFilePath();
  const rows = JSON.parse(
    fs.readFileSync(rowsFilePath, 'utf8').replace(/^\uFEFF/, '')
  );
  const sanitizedRows = Array.isArray(rows)
    ? rows.filter((row) => row && row.barcode && row.name)
    : [];

  if (sanitizedRows.length === 0) {
    throw new Error('No product rows were provided for catalog replacement.');
  }

  const databasePaths = getTargetDatabasePaths();

  if (databasePaths.length === 0) {
    throw new Error('No offline-pos.sqlite database files were found to update.');
  }

  const results = [];

  for (const databasePath of databasePaths) {
    const db = new Database(databasePath);

    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      ensureProductSchemaSupportsNullableCatalog(db);
      replaceCatalog(db, sanitizedRows);
      const productCount = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
      results.push({
        databasePath,
        productCount
      });
    } finally {
      db.close();
    }
  }

  console.log(JSON.stringify({ replaced: sanitizedRows.length, results }, null, 2));
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
