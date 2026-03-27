const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let database;
let databasePath = '';

function parseCsvRows(contents) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const nextCharacter = contents[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentField);
      currentField = '';

      if (currentRow.some((value) => String(value || '').trim())) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);

    if (currentRow.some((value) => String(value || '').trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function getSeedCatalogPath() {
  return path.join(__dirname, 'assets', 'product-seed.csv');
}

function loadSeedProducts() {
  const seedFilePath = getSeedCatalogPath();

  if (!fs.existsSync(seedFilePath)) {
    throw new Error(`Seed catalog not found at ${seedFilePath}`);
  }

  const rows = parseCsvRows(fs.readFileSync(seedFilePath, 'utf8'));

  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) =>
    String(header || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
  );
  const barcodeIndex = headers.findIndex((header) => header === 'barcode');
  const nameIndex = headers.findIndex((header) => header === 'product name');

  if (barcodeIndex === -1 || nameIndex === -1) {
    throw new Error('Seed catalog must contain Barcode and Product Name columns.');
  }

  return dataRows
    .map((row) => ({
      barcode: String(row[barcodeIndex] || '').trim(),
      name: String(row[nameIndex] || '').trim()
    }))
    .filter((row) => row.barcode && row.name);
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

function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT NULL,
      opening_cash REAL NOT NULL,
      closing_cash REAL NULL,
      total_sales REAL NOT NULL DEFAULT 0,
      expected_cash REAL NOT NULL DEFAULT 0,
      difference REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS products (
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
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL DEFAULT 'default-store',
      shift_id INTEGER NULL,
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      synced_at TEXT NULL,
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      cost_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function ensureTimestampColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} TEXT NULL`);
  }
}

function productTableNeedsRebuild(db) {
  const columns = db.prepare(`PRAGMA table_info(products)`).all();
  const costPriceColumn = columns.find((column) => column.name === 'cost_price');
  const sellingPriceColumn = columns.find((column) => column.name === 'selling_price');

  if (!costPriceColumn || !sellingPriceColumn) {
    return false;
  }

  return Number(costPriceColumn.notnull) === 1 || Number(sellingPriceColumn.notnull) === 1;
}

function rebuildProductsTable(db) {
  const copyIntoNewTable = db.transaction(() => {
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
    copyIntoNewTable();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function runMigrations(db) {
  ensureColumn(
    db,
    'sales',
    'store_id',
    "TEXT NOT NULL DEFAULT 'default-store'"
  );
  ensureColumn(db, 'sales', 'shift_id', 'INTEGER NULL');
  ensureColumn(db, 'sales', 'synced_at', 'TEXT NULL');

  ensureColumn(db, 'products', 'cloud_product_id', 'INTEGER NULL');
  ensureColumn(db, 'products', 'created_source', "TEXT NOT NULL DEFAULT 'pos'");
  ensureTimestampColumn(db, 'products', 'catalog_updated_at');
  ensureTimestampColumn(db, 'products', 'stock_updated_at');
  ensureTimestampColumn(db, 'products', 'archived_at');

  if (productTableNeedsRebuild(db)) {
    rebuildProductsTable(db);
  }

  db.exec(`
    UPDATE products
    SET created_source = COALESCE(NULLIF(created_source, ''), 'pos');

    UPDATE products
    SET catalog_updated_at = COALESCE(
      NULLIF(catalog_updated_at, ''),
      created_at,
      CURRENT_TIMESTAMP
    );

    UPDATE products
    SET stock_updated_at = COALESCE(
      NULLIF(stock_updated_at, ''),
      created_at,
      CURRENT_TIMESTAMP
    );

    UPDATE products
    SET stock = COALESCE(stock, 0);

    DROP INDEX IF EXISTS idx_products_barcode;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
    ON products(barcode)
    WHERE archived_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products(name);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_cloud_product_id
    ON products(cloud_product_id)
    WHERE cloud_product_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_sales_shift_id
    ON sales(shift_id);
  `);
}

function seedImportedCatalog(db) {
  const { total } = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM products
        WHERE archived_at IS NULL
      `
    )
    .get();

  if (total > 0) {
    return;
  }

  const seedProducts = loadSeedProducts();

  if (seedProducts.length === 0) {
    return;
  }

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

  const seedTransaction = db.transaction((products) => {
    for (const product of products) {
      insertProduct.run(product);
    }
  });

  seedTransaction(seedProducts);
}

function initializeDatabase(userDataPath) {
  if (database) {
    return database;
  }

  fs.mkdirSync(userDataPath, { recursive: true });

  databasePath = path.join(userDataPath, 'offline-pos.sqlite');
  database = new Database(databasePath);

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  createTables(database);
  runMigrations(database);
  seedImportedCatalog(database);

  return database;
}

function getDatabase() {
  if (!database) {
    throw new Error('Database has not been initialized.');
  }

  return database;
}

function getDatabasePath() {
  if (!databasePath) {
    throw new Error('Database path has not been initialized.');
  }

  return databasePath;
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getDatabasePath
};
