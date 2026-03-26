const { Pool } = require('pg');

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

let pool;

function hasDatabaseConfig() {
  return Boolean(connectionString);
}

function getPool() {
  if (!hasDatabaseConfig()) {
    throw new Error(
      'Supabase Postgres connection string is missing. Set SUPABASE_DB_URL.'
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function withTransaction(work) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureCloudSchema() {
  if (!hasDatabaseConfig()) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS sales (
      id BIGSERIAL PRIMARY KEY,
      store_id TEXT NOT NULL,
      pos_sale_id BIGINT NOT NULL,
      total_amount NUMERIC(12, 2) NOT NULL,
      total_cost NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sync_status TEXT NOT NULL DEFAULT 'synced',
      UNIQUE (store_id, pos_sale_id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id BIGSERIAL PRIMARY KEY,
      sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id BIGINT,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price NUMERIC(12, 2) NOT NULL,
      cost_price NUMERIC(12, 2) NOT NULL,
      UNIQUE (sale_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id BIGINT,
      name TEXT NOT NULL,
      barcode TEXT,
      cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      catalog_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      stock_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_source TEXT NOT NULL DEFAULT 'pos',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE SEQUENCE IF NOT EXISTS products_id_seq;

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS id BIGINT;

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS catalog_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS created_source TEXT NOT NULL DEFAULT 'pos';

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER SEQUENCE products_id_seq OWNED BY products.id;

    ALTER TABLE products
    ALTER COLUMN id SET DEFAULT nextval('products_id_seq');

    UPDATE products
    SET id = DEFAULT
    WHERE id IS NULL;

    UPDATE products
    SET catalog_updated_at = COALESCE(catalog_updated_at, updated_at, NOW()),
        stock_updated_at = COALESCE(stock_updated_at, updated_at, NOW()),
        created_source = COALESCE(NULLIF(created_source, ''), 'pos'),
        created_at = COALESCE(created_at, updated_at, NOW()),
        updated_at = COALESCE(updated_at, NOW());

    SELECT setval(
      'products_id_seq',
      GREATEST(COALESCE((SELECT MAX(id) FROM products), 0), 1),
      true
    );

    ALTER TABLE products
    ALTER COLUMN id SET NOT NULL;

    ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_pkey;

    ALTER TABLE products
    ALTER COLUMN product_id DROP NOT NULL;

    ALTER TABLE products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_created_at
    ON sales(created_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_barcode_unique
    ON products(store_id, barcode)
    WHERE barcode IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products(store_id, name);

    CREATE INDEX IF NOT EXISTS idx_products_updated_at
    ON products(updated_at DESC);
  `);
}

module.exports = {
  hasDatabaseConfig,
  getPool,
  query,
  withTransaction,
  ensureCloudSchema
};
