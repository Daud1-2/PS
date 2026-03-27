const express = require('express');
const { query, withTransaction } = require('../db');

const router = express.Router();
const DEFAULT_STORE_ID =
  String(process.env.DEFAULT_STORE_ID || process.env.STORE_ID || 'default-store').trim() ||
  'default-store';

function parseTimestamp(value, fallback = new Date().toISOString()) {
  const parsed = new Date(value || '');

  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

function serializeProduct(row) {
  return {
    id: Number(row.id),
    storeId: row.storeId,
    productId:
      row.productId === null || row.productId === undefined
        ? null
        : Number(row.productId),
    name: row.name,
    barcode: row.barcode,
    costPrice: Number(row.costPrice),
    sellingPrice: Number(row.sellingPrice),
    stock: Number(row.stock),
    catalogUpdatedAt: row.catalogUpdatedAt,
    stockUpdatedAt: row.stockUpdatedAt,
    createdSource: row.createdSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapProductRowQuery() {
  return `
    SELECT
      id,
      store_id AS "storeId",
      product_id AS "productId",
      name,
      barcode,
      cost_price AS "costPrice",
      selling_price AS "sellingPrice",
      stock,
      catalog_updated_at AS "catalogUpdatedAt",
      stock_updated_at AS "stockUpdatedAt",
      created_source AS "createdSource",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM products
  `;
}

function normalizeProductInput(input) {
  const requestedStoreId =
    String(input?.storeId || DEFAULT_STORE_ID).trim() || DEFAULT_STORE_ID;

  if (requestedStoreId !== DEFAULT_STORE_ID) {
    throw new Error('Product store id does not match the configured store.');
  }

  const payload = {
    storeId: DEFAULT_STORE_ID,
    name: String(input?.name || '').trim(),
    barcode: String(input?.barcode || '').trim(),
    costPrice: Number(input?.costPrice),
    sellingPrice: Number(input?.sellingPrice),
    stock: Number(input?.stock),
    createdSource: String(input?.createdSource || 'admin').trim() || 'admin',
    catalogUpdatedAt: parseTimestamp(input?.catalogUpdatedAt),
    stockUpdatedAt: parseTimestamp(input?.stockUpdatedAt)
  };

  if (!payload.name) {
    throw new Error('Product name is required.');
  }

  if (!payload.barcode) {
    throw new Error('Product barcode is required.');
  }

  if (!Number.isFinite(payload.costPrice)) {
    throw new Error('Valid product cost price is required.');
  }

  if (!Number.isFinite(payload.sellingPrice)) {
    throw new Error('Valid product selling price is required.');
  }

  if (!Number.isInteger(payload.stock) || payload.stock < 0) {
    throw new Error('Valid product stock is required.');
  }

  return payload;
}

function isIncomingNewer(incomingTimestamp, existingTimestamp) {
  return new Date(incomingTimestamp).getTime() >= new Date(existingTimestamp).getTime();
}

async function findExistingProduct(client, product) {
  if (product.cloudProductId) {
    const byId = await client.query(
      `
        ${mapProductRowQuery()}
        WHERE id = $1 AND store_id = $2
        LIMIT 1
      `,
      [product.cloudProductId, product.storeId]
    );

    if (byId.rows[0]) {
      return serializeProduct(byId.rows[0]);
    }
  }

  if (product.barcode) {
    const byBarcode = await client.query(
      `
        ${mapProductRowQuery()}
        WHERE store_id = $1 AND barcode = $2
        LIMIT 1
      `,
      [product.storeId, product.barcode]
    );

    if (byBarcode.rows[0]) {
      return serializeProduct(byBarcode.rows[0]);
    }
  }

  return null;
}

async function insertProduct(client, product) {
  const returningClause = `
    RETURNING
      id,
      store_id AS "storeId",
      product_id AS "productId",
      name,
      barcode,
      cost_price AS "costPrice",
      selling_price AS "sellingPrice",
      stock,
      catalog_updated_at AS "catalogUpdatedAt",
      stock_updated_at AS "stockUpdatedAt",
      created_source AS "createdSource",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  const result = product.cloudProductId
    ? await client.query(
        `
          INSERT INTO products (
            id,
            store_id,
            product_id,
            name,
            barcode,
            cost_price,
            selling_price,
            stock,
            catalog_updated_at,
            stock_updated_at,
            created_source,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            NOW(),
            NOW()
          )
          ${returningClause}
        `,
        [
          product.cloudProductId,
          product.storeId,
          product.localProductId || null,
          product.name,
          product.barcode,
          product.costPrice,
          product.sellingPrice,
          product.stock,
          product.catalogUpdatedAt,
          product.stockUpdatedAt,
          product.createdSource
        ]
      )
    : await client.query(
        `
          INSERT INTO products (
            store_id,
            product_id,
            name,
            barcode,
            cost_price,
            selling_price,
            stock,
            catalog_updated_at,
            stock_updated_at,
            created_source,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW(),
            NOW()
          )
          ${returningClause}
        `,
        [
          product.storeId,
          product.localProductId || null,
          product.name,
          product.barcode,
          product.costPrice,
          product.sellingPrice,
          product.stock,
          product.catalogUpdatedAt,
          product.stockUpdatedAt,
          product.createdSource
        ]
      );

  return serializeProduct(result.rows[0]);
}

async function updateProduct(client, existingProduct, product) {
  const useIncomingCatalog = isIncomingNewer(
    product.catalogUpdatedAt,
    existingProduct.catalogUpdatedAt
  );
  const useIncomingStock = isIncomingNewer(
    product.stockUpdatedAt,
    existingProduct.stockUpdatedAt
  );

  const result = await client.query(
    `
      UPDATE products
      SET product_id = COALESCE($2, product_id),
          name = $3,
          barcode = $4,
          cost_price = $5,
          selling_price = $6,
          stock = $7,
          catalog_updated_at = $8,
          stock_updated_at = $9,
          created_source = COALESCE(created_source, $10),
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        store_id AS "storeId",
        product_id AS "productId",
        name,
        barcode,
        cost_price AS "costPrice",
        selling_price AS "sellingPrice",
        stock,
        catalog_updated_at AS "catalogUpdatedAt",
        stock_updated_at AS "stockUpdatedAt",
        created_source AS "createdSource",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [
      existingProduct.id,
      product.localProductId || existingProduct.productId || null,
      useIncomingCatalog ? product.name : existingProduct.name,
      useIncomingCatalog ? product.barcode : existingProduct.barcode,
      useIncomingCatalog ? product.costPrice : existingProduct.costPrice,
      useIncomingCatalog ? product.sellingPrice : existingProduct.sellingPrice,
      useIncomingStock ? product.stock : existingProduct.stock,
      useIncomingCatalog
        ? product.catalogUpdatedAt
        : existingProduct.catalogUpdatedAt,
      useIncomingStock ? product.stockUpdatedAt : existingProduct.stockUpdatedAt,
      existingProduct.createdSource || product.createdSource
    ]
  );

  return serializeProduct(result.rows[0]);
}

async function upsertSyncedProduct(client, incomingProduct) {
  const normalized = {
    ...normalizeProductInput(incomingProduct),
    localProductId:
      incomingProduct?.localProductId === null ||
      incomingProduct?.localProductId === undefined
        ? null
        : Number(incomingProduct.localProductId),
    cloudProductId:
      incomingProduct?.cloudProductId === null ||
      incomingProduct?.cloudProductId === undefined
        ? null
        : Number(incomingProduct.cloudProductId)
  };

  const existing = await findExistingProduct(client, normalized);

  if (!existing) {
    return insertProduct(client, normalized);
  }

  return updateProduct(client, existing, normalized);
}

router.get('/products', async (req, res, next) => {
  try {
    const updatedSince = String(req.query.updatedSince || '').trim();
    const params = [DEFAULT_STORE_ID];
    let whereClause = 'WHERE store_id = $1';

    if (updatedSince) {
      whereClause += ' AND updated_at > $2';
      params.push(parseTimestamp(updatedSince));
    }

    const productResult = await query(
      `
        ${mapProductRowQuery()}
        ${whereClause}
        ORDER BY updated_at ASC, name ASC
      `,
      params
    );

    res.json({
      products: productResult.rows.map(serializeProduct),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const payload = normalizeProductInput(req.body);
    const result = await query(
      `
        INSERT INTO products (
          store_id,
          name,
          barcode,
          cost_price,
          selling_price,
          stock,
          catalog_updated_at,
          stock_updated_at,
          created_source,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'admin', NOW(), NOW())
        RETURNING
          id,
          store_id AS "storeId",
          product_id AS "productId",
          name,
          barcode,
          cost_price AS "costPrice",
          selling_price AS "sellingPrice",
          stock,
          catalog_updated_at AS "catalogUpdatedAt",
          stock_updated_at AS "stockUpdatedAt",
          created_source AS "createdSource",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        payload.storeId,
        payload.name,
        payload.barcode,
        payload.costPrice,
        payload.sellingPrice,
        payload.stock
      ]
    );

    res.status(201).json({
      product: serializeProduct(result.rows[0]),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({
        error: 'A product with this barcode already exists.'
      });
      return;
    }

    next(error);
  }
});

router.put('/products/:id', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({
        error: 'Invalid product id.'
      });
      return;
    }

    const payload = normalizeProductInput(req.body);
    const existingResult = await query(
      `
        ${mapProductRowQuery()}
        WHERE id = $1 AND store_id = $2
        LIMIT 1
      `,
      [productId, payload.storeId]
    );

    if (!existingResult.rows[0]) {
      res.status(404).json({
        error: 'Product not found.'
      });
      return;
    }

    const existing = serializeProduct(existingResult.rows[0]);
    const nextCatalogTimestamp =
      payload.name !== existing.name ||
      payload.barcode !== existing.barcode ||
      Number(payload.costPrice) !== Number(existing.costPrice) ||
      Number(payload.sellingPrice) !== Number(existing.sellingPrice)
        ? new Date().toISOString()
        : existing.catalogUpdatedAt;
    const nextStockTimestamp =
      Number(payload.stock) !== Number(existing.stock)
        ? new Date().toISOString()
        : existing.stockUpdatedAt;

    const updateResult = await query(
      `
        UPDATE products
        SET name = $2,
            barcode = $3,
            cost_price = $4,
            selling_price = $5,
            stock = $6,
            catalog_updated_at = $7,
            stock_updated_at = $8,
            created_source = 'admin',
            updated_at = NOW()
        WHERE id = $1 AND store_id = $9
        RETURNING
          id,
          store_id AS "storeId",
          product_id AS "productId",
          name,
          barcode,
          cost_price AS "costPrice",
          selling_price AS "sellingPrice",
          stock,
          catalog_updated_at AS "catalogUpdatedAt",
          stock_updated_at AS "stockUpdatedAt",
          created_source AS "createdSource",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        productId,
        payload.name,
        payload.barcode,
        payload.costPrice,
        payload.sellingPrice,
        payload.stock,
        nextCatalogTimestamp,
        nextStockTimestamp,
        payload.storeId
      ]
    );

    res.json({
      product: serializeProduct(updateResult.rows[0]),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({
        error: 'A product with this barcode already exists.'
      });
      return;
    }

    next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({
        error: 'Invalid product id.'
      });
      return;
    }

    const existingResult = await query(
      `
        ${mapProductRowQuery()}
        WHERE id = $1 AND store_id = $2
        LIMIT 1
      `,
      [productId, DEFAULT_STORE_ID]
    );

    if (!existingResult.rows[0]) {
      res.status(404).json({
        error: 'Product not found.'
      });
      return;
    }

    await query(
      `
        DELETE FROM products
        WHERE id = $1 AND store_id = $2
      `,
      [productId, DEFAULT_STORE_ID]
    );

    res.json({
      deleted: true,
      product: serializeProduct(existingResult.rows[0]),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sync/products', async (req, res, next) => {
  const incomingProducts = Array.isArray(req.body?.products)
    ? req.body.products
    : [];

  if (incomingProducts.length === 0) {
    res.status(400).json({
      error: 'No products provided for sync.'
    });
    return;
  }

  try {
    const products = await withTransaction(async (client) => {
      const syncedProducts = [];

      for (const incomingProduct of incomingProducts) {
        const syncedProduct = await upsertSyncedProduct(client, incomingProduct);
        syncedProducts.push({
          ...syncedProduct,
          localProductId:
            incomingProduct?.localProductId === null ||
            incomingProduct?.localProductId === undefined
              ? null
              : Number(incomingProduct.localProductId)
        });
      }

      return syncedProducts;
    });

    res.json({
      products,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({
        error: 'Product sync conflict: barcode already exists.'
      });
      return;
    }

    next(error);
  }
});

module.exports = router;
