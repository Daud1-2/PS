const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let database;
let databasePath = '';

const sampleProducts = [
  {
    name: 'Milk 1L',
    barcode: '100000000001',
    costPrice: 1.45,
    sellingPrice: 2.1,
    stock: 32
  },
  {
    name: 'Bread Loaf',
    barcode: '100000000002',
    costPrice: 0.95,
    sellingPrice: 1.5,
    stock: 28
  },
  {
    name: 'Eggs Dozen',
    barcode: '100000000003',
    costPrice: 2.15,
    sellingPrice: 3.0,
    stock: 18
  },
  {
    name: 'Bottled Water 500ml',
    barcode: '100000000004',
    costPrice: 0.3,
    sellingPrice: 0.75,
    stock: 96
  },
  {
    name: 'Coffee 200g',
    barcode: '100000000005',
    costPrice: 4.25,
    sellingPrice: 6.5,
    stock: 14
  }
];

function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_product_id INTEGER,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      created_source TEXT NOT NULL DEFAULT 'pos',
      catalog_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      stock_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL DEFAULT 'default-store',
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      synced_at TEXT NULL
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
    ON products(barcode);

    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products(name);
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

function runMigrations(db) {
  ensureColumn(
    db,
    'sales',
    'store_id',
    "TEXT NOT NULL DEFAULT 'default-store'"
  );
  ensureColumn(db, 'sales', 'synced_at', 'TEXT NULL');

  ensureColumn(db, 'products', 'cloud_product_id', 'INTEGER NULL');
  ensureColumn(db, 'products', 'created_source', "TEXT NOT NULL DEFAULT 'pos'");
  ensureTimestampColumn(db, 'products', 'catalog_updated_at');
  ensureTimestampColumn(db, 'products', 'stock_updated_at');

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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_cloud_product_id
    ON products(cloud_product_id)
    WHERE cloud_product_id IS NOT NULL;
  `);
}

function seedSampleProducts(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM products').get();

  if (total > 0) {
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
      @costPrice,
      @sellingPrice,
      @stock,
      'pos',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const seedTransaction = db.transaction((products) => {
    for (const product of products) {
      insertProduct.run(product);
    }
  });

  seedTransaction(sampleProducts);
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
  seedSampleProducts(database);

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
