const express = require('express');
const { query, withTransaction } = require('../db');

const router = express.Router();

function parseTimestamp(value, fallback = new Date().toISOString()) {
  const parsed = new Date(value || '');

  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

async function findCloudProduct(client, item, storeId) {
  if (item?.cloudProductId) {
    const byId = await client.query(
      `
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
        WHERE id = $1 AND store_id = $2
        LIMIT 1
      `,
      [item.cloudProductId, storeId]
    );

    if (byId.rows[0]) {
      return byId.rows[0];
    }
  }

  if (item?.barcode) {
    const byBarcode = await client.query(
      `
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
        WHERE store_id = $1 AND barcode = $2
        LIMIT 1
      `,
      [storeId, item.barcode]
    );

    if (byBarcode.rows[0]) {
      return byBarcode.rows[0];
    }
  }

  return null;
}

function isIncomingNewer(incomingTimestamp, existingTimestamp) {
  return new Date(incomingTimestamp).getTime() >= new Date(existingTimestamp).getTime();
}

async function upsertProductFromSaleItem(client, sale, item) {
  const storeId = sale.storeId;
  const catalogUpdatedAt = parseTimestamp(
    item.catalogUpdatedAt,
    sale.createdAt || new Date().toISOString()
  );
  const stockUpdatedAt = parseTimestamp(
    item.stockUpdatedAt,
    sale.createdAt || new Date().toISOString()
  );
  const existingProduct = await findCloudProduct(client, item, storeId);

  if (!existingProduct) {
    if (item.cloudProductId) {
      await client.query(
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
        `,
        [
          item.cloudProductId,
          storeId,
          item.localProductId || null,
          item.productName,
          item.barcode || null,
          item.costPrice,
          item.price,
          item.stock,
          catalogUpdatedAt,
          stockUpdatedAt,
          item.createdSource || 'pos'
        ]
      );
    } else {
      await client.query(
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
        `,
        [
          storeId,
          item.localProductId || null,
          item.productName,
          item.barcode || null,
          item.costPrice,
          item.price,
          item.stock,
          catalogUpdatedAt,
          stockUpdatedAt,
          item.createdSource || 'pos'
        ]
      );
    }
    return;
  }

  const useIncomingCatalog = isIncomingNewer(
    catalogUpdatedAt,
    existingProduct.catalogUpdatedAt
  );
  const useIncomingStock = isIncomingNewer(
    stockUpdatedAt,
    existingProduct.stockUpdatedAt
  );

  await client.query(
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
    `,
    [
      existingProduct.id,
      item.localProductId || existingProduct.productId || null,
      useIncomingCatalog ? item.productName : existingProduct.name,
      useIncomingCatalog ? item.barcode || null : existingProduct.barcode,
      useIncomingCatalog ? item.costPrice : existingProduct.costPrice,
      useIncomingCatalog ? item.price : existingProduct.sellingPrice,
      useIncomingStock ? item.stock : existingProduct.stock,
      useIncomingCatalog ? catalogUpdatedAt : existingProduct.catalogUpdatedAt,
      useIncomingStock ? stockUpdatedAt : existingProduct.stockUpdatedAt,
      existingProduct.createdSource || item.createdSource || 'pos'
    ]
  );
}

router.post('/sync/sales', async (req, res, next) => {
  const incomingSales = Array.isArray(req.body?.sales) ? req.body.sales : [];

  if (incomingSales.length === 0) {
    res.status(400).json({
      error: 'No sales provided for sync.'
    });
    return;
  }

  try {
    const syncedSales = await withTransaction(async (client) => {
      const syncedAt = new Date().toISOString();
      const syncedResults = [];

      for (const payload of incomingSales) {
        const sale = payload?.sale;
        const items = Array.isArray(payload?.items) ? payload.items : [];

        if (!sale?.posSaleId || !sale?.storeId) {
          throw new Error('Invalid sale payload.');
        }

        const saleResult = await client.query(
          `
            INSERT INTO sales (
              store_id,
              pos_sale_id,
              total_amount,
              total_cost,
              created_at,
              received_at,
              sync_status
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), 'synced')
            ON CONFLICT (store_id, pos_sale_id)
            DO UPDATE SET
              total_amount = EXCLUDED.total_amount,
              total_cost = EXCLUDED.total_cost,
              created_at = EXCLUDED.created_at,
              received_at = NOW(),
              sync_status = 'synced'
            RETURNING id, store_id, pos_sale_id
          `,
          [
            sale.storeId,
            sale.posSaleId,
            sale.totalAmount,
            sale.totalCost,
            sale.createdAt
          ]
        );

        const cloudSaleId = saleResult.rows[0].id;

        await client.query('DELETE FROM sale_items WHERE sale_id = $1', [
          cloudSaleId
        ]);

        for (const item of items) {
          const cloudProductId =
            item?.cloudProductId === null || item?.cloudProductId === undefined
              ? null
              : Number(item.cloudProductId);

          await client.query(
            `
              INSERT INTO sale_items (
                sale_id,
                product_id,
                product_name,
                quantity,
                price,
                cost_price
              )
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
              cloudSaleId,
              cloudProductId,
              item.productName,
              item.quantity,
              item.price,
              item.costPrice
            ]
          );

          await upsertProductFromSaleItem(client, sale, item);
        }

        syncedResults.push({
          saleId: sale.posSaleId,
          storeId: sale.storeId,
          syncedAt
        });
      }

      return syncedResults;
    });

    res.json({
      syncedSales
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sales', async (_req, res, next) => {
  try {
    const [dailyResult, summaryResult, topProductsResult, syncResult] =
      await Promise.all([
        query(`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS "salesCount",
            COALESCE(SUM(total_amount), 0)::float AS "totalAmount",
            COALESCE(SUM(total_cost), 0)::float AS "totalCost",
            COALESCE(SUM(total_amount - total_cost), 0)::float AS profit
          FROM sales
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY DATE_TRUNC('day', created_at) DESC
          LIMIT 30
        `),
        query(`
          SELECT
            COUNT(*)::int AS "salesCount",
            COALESCE(SUM(total_amount), 0)::float AS "totalAmount",
            COALESCE(SUM(total_cost), 0)::float AS "totalCost",
            COALESCE(SUM(total_amount - total_cost), 0)::float AS profit
          FROM sales
        `),
        query(`
          SELECT
            COALESCE(si.product_id, 0)::bigint AS "productId",
            si.product_name AS "productName",
            COALESCE(SUM(si.quantity), 0)::int AS "quantitySold",
            COALESCE(SUM(si.quantity * si.price), 0)::float AS revenue
          FROM sale_items si
          GROUP BY si.product_id, si.product_name
          ORDER BY "quantitySold" DESC, revenue DESC
          LIMIT 5
        `),
        query(`
          SELECT MAX(received_at) AS "lastSyncTime"
          FROM sales
        `)
      ]);

    res.json({
      summary: summaryResult.rows[0],
      daily: dailyResult.rows,
      topProducts: topProductsResult.rows.map((row) => ({
        productId: Number(row.productId),
        productName: row.productName,
        quantitySold: Number(row.quantitySold),
        revenue: Number(row.revenue)
      })),
      lastSyncTime: syncResult.rows[0]?.lastSyncTime || null
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
