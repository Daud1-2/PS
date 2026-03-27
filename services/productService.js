const { getDatabase } = require('../database/db');
const { getAppConfig } = require('../config/appConfig');

function getDefaultStoreId() {
  return getAppConfig().storeId;
}

function normalizeTimestamp(value, fallback = new Date().toISOString()) {
  const timestamp = String(value || '').trim();

  if (!timestamp) {
    return fallback;
  }

  const parsed = new Date(timestamp);

  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function parseTimestamp(value) {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function hasProvidedValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function normalizeNullableNumber(value) {
  if (!hasProvidedValue(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInteger(value, fieldName, options = {}) {
  const required = options.required !== false;
  const fallback =
    options.fallback !== undefined ? Number(options.fallback) : 0;

  if (!hasProvidedValue(value)) {
    if (required) {
      throw new Error(`Valid product ${fieldName} is required.`);
    }

    if (!Number.isInteger(fallback) || fallback < 0) {
      return 0;
    }

    return fallback;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Valid product ${fieldName} is required.`);
  }

  return parsed;
}

function normalizeMoney(value, fieldName, options = {}) {
  const required = options.required !== false;

  if (!hasProvidedValue(value)) {
    if (required) {
      throw new Error(`Valid product ${fieldName} is required.`);
    }

    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valid product ${fieldName} is required.`);
  }

  return parsed;
}

function areNullableNumbersEqual(left, right) {
  if (left === null && right === null) {
    return true;
  }

  return Number(left) === Number(right);
}

function isSellableProduct(product) {
  return normalizeNullableNumber(product?.sellingPrice) !== null;
}

function mapProductRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    cloudProductId:
      row.cloudProductId === null || row.cloudProductId === undefined
        ? null
        : Number(row.cloudProductId),
    name: row.name,
    barcode: row.barcode,
    costPrice: normalizeNullableNumber(row.costPrice),
    sellingPrice: normalizeNullableNumber(row.sellingPrice),
    stock:
      row.stock === null || row.stock === undefined ? 0 : Number(row.stock),
    createdSource: row.createdSource,
    catalogUpdatedAt: row.catalogUpdatedAt,
    stockUpdatedAt: row.stockUpdatedAt,
    createdAt: row.createdAt
  };
}

function selectProductFields() {
  return `
    SELECT
      id,
      cloud_product_id AS cloudProductId,
      name,
      barcode,
      cost_price AS costPrice,
      selling_price AS sellingPrice,
      stock,
      created_source AS createdSource,
      catalog_updated_at AS catalogUpdatedAt,
      stock_updated_at AS stockUpdatedAt,
      created_at AS createdAt
    FROM products
  `;
}

function activeProductsClause(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}archived_at IS NULL`;
}

function getProductByBarcode(barcode) {
  const normalizedBarcode = String(barcode || '').trim();

  if (!normalizedBarcode) {
    return null;
  }

  const db = getDatabase();

  return mapProductRow(
    db
      .prepare(
        `
          ${selectProductFields()}
          WHERE barcode = ?
            AND ${activeProductsClause()}
          LIMIT 1
        `
      )
      .get(normalizedBarcode)
  );
}

function searchProducts(query, limit = 8) {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return [];
  }

  const db = getDatabase();
  const nameQuery = normalizedQuery.toLowerCase();

  return db
    .prepare(
      `
        ${selectProductFields()}
        WHERE ${activeProductsClause()}
          AND (
            barcode LIKE @barcodeContains
            OR lower(name) LIKE @nameContains
          )
        ORDER BY
          CASE
            WHEN barcode = @exactBarcode THEN 0
            WHEN barcode LIKE @barcodePrefix THEN 1
            WHEN lower(name) = @exactName THEN 2
            WHEN lower(name) LIKE @namePrefix THEN 3
            ELSE 4
          END,
          name COLLATE NOCASE ASC
        LIMIT @limit
      `
    )
    .all({
      exactBarcode: normalizedQuery,
      exactName: nameQuery,
      barcodePrefix: `${normalizedQuery}%`,
      barcodeContains: `%${normalizedQuery}%`,
      namePrefix: `${nameQuery}%`,
      nameContains: `%${nameQuery}%`,
      limit: Number(limit)
    })
    .map(mapProductRow);
}

function listProducts(query = '', limit = 5000) {
  const normalizedQuery = String(query || '').trim();
  const db = getDatabase();

  if (!normalizedQuery) {
    return db
      .prepare(
        `
          ${selectProductFields()}
          WHERE ${activeProductsClause()}
          ORDER BY id ASC
          LIMIT ?
        `
      )
      .all(Number(limit))
      .map(mapProductRow);
  }

  const loweredQuery = normalizedQuery.toLowerCase();

  return db
    .prepare(
      `
        ${selectProductFields()}
        WHERE ${activeProductsClause()}
          AND (
            barcode LIKE @barcodeContains
            OR lower(name) LIKE @nameContains
          )
        ORDER BY
          CASE
            WHEN barcode = @exactBarcode THEN 0
            WHEN barcode LIKE @barcodePrefix THEN 1
            WHEN lower(name) = @exactName THEN 2
            WHEN lower(name) LIKE @namePrefix THEN 3
            ELSE 4
          END,
          name COLLATE NOCASE ASC,
          id DESC
        LIMIT @limit
      `
    )
    .all({
      exactBarcode: normalizedQuery,
      exactName: loweredQuery,
      barcodePrefix: `${normalizedQuery}%`,
      barcodeContains: `%${normalizedQuery}%`,
      namePrefix: `${loweredQuery}%`,
      nameContains: `%${loweredQuery}%`,
      limit: Number(limit)
    })
    .map(mapProductRow);
}

function normalizeProductPayload(product, options = {}) {
  const now = new Date().toISOString();
  const payload = {
    name: String(product?.name || '').trim(),
    barcode: String(product?.barcode || '').trim(),
    costPrice: normalizeMoney(product?.costPrice, 'cost price', {
      required: options.requireCost !== false
    }),
    sellingPrice: normalizeMoney(product?.sellingPrice, 'selling price', {
      required: options.requireSellingPrice !== false
    }),
    stock: normalizeInteger(product?.stock, 'stock', {
      required: options.requireStock !== false,
      fallback: options.defaultStock ?? 0
    }),
    cloudProductId:
      product?.cloudProductId === null || product?.cloudProductId === undefined
        ? null
        : Number(product.cloudProductId),
    catalogUpdatedAt: normalizeTimestamp(product?.catalogUpdatedAt, now),
    stockUpdatedAt: normalizeTimestamp(product?.stockUpdatedAt, now),
    createdSource: String(
      product?.createdSource || options.createdSource || 'pos'
    ).trim()
  };

  if (!payload.name) {
    throw new Error('Product name is required.');
  }

  if (!payload.barcode) {
    throw new Error('Product barcode is required.');
  }

  if (
    payload.cloudProductId !== null &&
    (!Number.isInteger(payload.cloudProductId) || payload.cloudProductId <= 0)
  ) {
    throw new Error('Product cloud id is invalid.');
  }

  if (!payload.createdSource) {
    payload.createdSource = 'pos';
  }

  return payload;
}

function getActiveProductById(productId) {
  const db = getDatabase();

  return db
    .prepare(
      `
        ${selectProductFields()}
        WHERE id = ?
          AND ${activeProductsClause()}
        LIMIT 1
      `
    )
    .get(productId);
}

function persistProductUpdate(existingProduct, payload) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const hasCatalogChanges =
    payload.name !== existingProduct.name ||
    payload.barcode !== existingProduct.barcode ||
    !areNullableNumbersEqual(payload.costPrice, existingProduct.costPrice) ||
    !areNullableNumbersEqual(payload.sellingPrice, existingProduct.sellingPrice);
  const hasStockChanges = Number(payload.stock) !== Number(existingProduct.stock);

  const nextCatalogUpdatedAt = hasCatalogChanges
    ? now
    : existingProduct.catalogUpdatedAt;
  const nextStockUpdatedAt = hasStockChanges ? now : existingProduct.stockUpdatedAt;

  try {
    db.prepare(
      `
        UPDATE products
        SET cloud_product_id = @cloudProductId,
            name = @name,
            barcode = @barcode,
            cost_price = @costPrice,
            selling_price = @sellingPrice,
            stock = @stock,
            created_source = @createdSource,
            catalog_updated_at = @catalogUpdatedAt,
            stock_updated_at = @stockUpdatedAt
        WHERE id = @id
      `
    ).run({
      id: existingProduct.id,
      cloudProductId: payload.cloudProductId,
      name: payload.name,
      barcode: payload.barcode,
      costPrice: payload.costPrice,
      sellingPrice: payload.sellingPrice,
      stock: payload.stock,
      createdSource: payload.createdSource || existingProduct.createdSource || 'pos',
      catalogUpdatedAt: nextCatalogUpdatedAt,
      stockUpdatedAt: nextStockUpdatedAt
    });
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      throw new Error('Barcode already exists.');
    }

    throw error;
  }

  return mapProductRow(
    db
      .prepare(
        `
          ${selectProductFields()}
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(existingProduct.id)
  );
}

function addProduct(product, options = {}) {
  const db = getDatabase();
  const payload = normalizeProductPayload(product, {
    ...options,
    requireCost: true,
    requireSellingPrice: true,
    requireStock: true
  });
  let result;

  try {
    result = db
      .prepare(
        `
          INSERT INTO products (
            cloud_product_id,
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
            @cloudProductId,
            @name,
            @barcode,
            @costPrice,
            @sellingPrice,
            @stock,
            @createdSource,
            @catalogUpdatedAt,
            @stockUpdatedAt
          )
        `
      )
      .run(payload);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      throw new Error('Barcode already exists.');
    }

    throw error;
  }

  return mapProductRow(
    db
      .prepare(
        `
          ${selectProductFields()}
          WHERE id = ?
        `
      )
      .get(result.lastInsertRowid)
  );
}

function updateProduct(productId, product, options = {}) {
  const normalizedProductId = Number(productId);

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('Product id is invalid.');
  }

  if (options.partial) {
    return completeProduct(normalizedProductId, product, options);
  }

  const existingRow = getActiveProductById(normalizedProductId);

  if (!existingRow) {
    throw new Error('Product not found.');
  }

  const existingProduct = mapProductRow(existingRow);
  const payload = normalizeProductPayload(
    {
      ...existingProduct,
      ...product,
      cloudProductId:
        product?.cloudProductId !== undefined
          ? product.cloudProductId
          : existingProduct.cloudProductId,
      createdSource:
        product?.createdSource !== undefined
          ? product.createdSource
          : existingProduct.createdSource,
      catalogUpdatedAt: existingProduct.catalogUpdatedAt,
      stockUpdatedAt: existingProduct.stockUpdatedAt
    },
    {
      ...options,
      requireCost: true,
      requireSellingPrice: true,
      requireStock: true
    }
  );

  return persistProductUpdate(existingProduct, payload);
}

function completeProduct(productId, product, options = {}) {
  const normalizedProductId = Number(productId);

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('Product id is invalid.');
  }

  const existingRow = getActiveProductById(normalizedProductId);

  if (!existingRow) {
    throw new Error('Product not found.');
  }

  const existingProduct = mapProductRow(existingRow);
  const payload = normalizeProductPayload(
    {
      ...existingProduct,
      ...product,
      cloudProductId:
        product?.cloudProductId !== undefined
          ? product.cloudProductId
          : existingProduct.cloudProductId,
      createdSource:
        product?.createdSource !== undefined
          ? product.createdSource
          : existingProduct.createdSource,
      catalogUpdatedAt: existingProduct.catalogUpdatedAt,
      stockUpdatedAt: existingProduct.stockUpdatedAt
    },
    {
      ...options,
      requireCost: false,
      requireSellingPrice: true,
      requireStock: true
    }
  );

  return persistProductUpdate(existingProduct, payload);
}

function deleteProduct(productId) {
  const normalizedProductId = Number(productId);

  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('Product id is invalid.');
  }

  const db = getDatabase();
  const existingRow = getActiveProductById(normalizedProductId);

  if (!existingRow) {
    throw new Error('Product not found.');
  }

  const existingProduct = mapProductRow(existingRow);

  db.prepare(
    `
      UPDATE products
      SET archived_at = @archivedAt
      WHERE id = @id
    `
  ).run({
    archivedAt: new Date().toISOString(),
    id: normalizedProductId
  });

  return existingProduct;
}

function getProductsForSync(limit = 500) {
  const db = getDatabase();

  return db
    .prepare(
      `
        ${selectProductFields()}
        WHERE cloud_product_id IS NULL
          AND ${activeProductsClause()}
        ORDER BY catalog_updated_at DESC, stock_updated_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map(mapProductRow)
    .filter(isSellableProduct)
    .map((product) => ({
      localProductId: product.id,
      cloudProductId: product.cloudProductId,
      storeId: getDefaultStoreId(),
      name: product.name,
      barcode: product.barcode,
      costPrice: product.costPrice ?? 0,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      createdSource: product.createdSource,
      catalogUpdatedAt: product.catalogUpdatedAt,
      stockUpdatedAt: product.stockUpdatedAt
    }));
}

function applyCloudProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0
    };
  }

  const db = getDatabase();
  const findByCloudProductId = db.prepare(
    `
      ${selectProductFields()}
      WHERE cloud_product_id = ?
      LIMIT 1
    `
  );
  const findByLocalProductId = db.prepare(
    `
      ${selectProductFields()}
      WHERE id = ?
      LIMIT 1
    `
  );
  const findByBarcode = db.prepare(
    `
      ${selectProductFields()}
      WHERE barcode = ?
      LIMIT 1
    `
  );
  const insertProduct = db.prepare(
    `
      INSERT INTO products (
        cloud_product_id,
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
        @cloudProductId,
        @name,
        @barcode,
        @costPrice,
        @sellingPrice,
        @stock,
        @createdSource,
        @catalogUpdatedAt,
        @stockUpdatedAt
      )
    `
  );
  const updateProductStatement = db.prepare(
    `
      UPDATE products
      SET cloud_product_id = @cloudProductId,
          name = @name,
          barcode = @barcode,
          cost_price = @costPrice,
          selling_price = @sellingPrice,
          stock = @stock,
          created_source = @createdSource,
          catalog_updated_at = @catalogUpdatedAt,
          stock_updated_at = @stockUpdatedAt
      WHERE id = @id
    `
  );

  const applyTransaction = db.transaction((incomingProducts) => {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const cloudProduct of incomingProducts) {
      try {
        const normalized = normalizeProductPayload(
          {
            ...cloudProduct,
            cloudProductId:
              cloudProduct?.cloudProductId ?? cloudProduct?.id ?? null
          },
          {
            createdSource: cloudProduct?.createdSource || 'admin',
            requireCost: false,
            requireSellingPrice: true,
            requireStock: true
          }
        );

        const localProductId =
          cloudProduct?.localProductId === null ||
          cloudProduct?.localProductId === undefined
            ? cloudProduct?.productId === null ||
              cloudProduct?.productId === undefined
              ? null
              : Number(cloudProduct.productId)
            : Number(cloudProduct.localProductId);

        let existing = null;

        if (normalized.cloudProductId) {
          existing = findByCloudProductId.get(normalized.cloudProductId) || null;
        }

        if (!existing && Number.isInteger(localProductId) && localProductId > 0) {
          existing = findByLocalProductId.get(localProductId) || null;
        }

        if (!existing && normalized.barcode) {
          existing = findByBarcode.get(normalized.barcode) || null;
        }

        if (!existing) {
          insertProduct.run({
            ...normalized,
            createdSource: normalized.createdSource || 'admin'
          });
          inserted += 1;
          continue;
        }

        const existingProduct = mapProductRow(existing);
        const nextCatalogTimestamp =
          parseTimestamp(normalized.catalogUpdatedAt) >=
          parseTimestamp(existingProduct.catalogUpdatedAt)
            ? normalized.catalogUpdatedAt
            : existingProduct.catalogUpdatedAt;
        const nextStockTimestamp =
          parseTimestamp(normalized.stockUpdatedAt) >=
          parseTimestamp(existingProduct.stockUpdatedAt)
            ? normalized.stockUpdatedAt
            : existingProduct.stockUpdatedAt;

        const nextCatalogValues =
          parseTimestamp(normalized.catalogUpdatedAt) >=
          parseTimestamp(existingProduct.catalogUpdatedAt)
            ? normalized
            : existingProduct;
        const nextStock =
          parseTimestamp(normalized.stockUpdatedAt) >=
          parseTimestamp(existingProduct.stockUpdatedAt)
            ? normalized.stock
            : existingProduct.stock;

        updateProductStatement.run({
          id: existingProduct.id,
          cloudProductId:
            normalized.cloudProductId || existingProduct.cloudProductId || null,
          name: nextCatalogValues.name,
          barcode: nextCatalogValues.barcode,
          costPrice: nextCatalogValues.costPrice,
          sellingPrice: nextCatalogValues.sellingPrice,
          stock: Number(nextStock),
          createdSource:
            existingProduct.createdSource || normalized.createdSource || 'pos',
          catalogUpdatedAt: nextCatalogTimestamp,
          stockUpdatedAt: nextStockTimestamp
        });
        updated += 1;
      } catch (_error) {
        skipped += 1;
      }
    }

    return {
      inserted,
      updated,
      skipped
    };
  });

  return applyTransaction(products);
}

module.exports = {
  DEFAULT_STORE_ID: getDefaultStoreId,
  getProductByBarcode,
  searchProducts,
  listProducts,
  addProduct,
  updateProduct,
  completeProduct,
  deleteProduct,
  getProductsForSync,
  applyCloudProducts
};
