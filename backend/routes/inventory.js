const express = require('express');
const { query } = require('../db');

const router = express.Router();
const DEFAULT_STORE_ID =
  String(process.env.DEFAULT_STORE_ID || process.env.STORE_ID || 'default-store').trim() ||
  'default-store';

router.get('/inventory', async (_req, res, next) => {
  try {
    const [inventoryResult, syncResult] = await Promise.all([
      query(
        `
          SELECT
            id AS "productId",
            store_id AS "storeId",
            name,
            barcode,
            stock,
            updated_at AS "updatedAt"
          FROM products
          WHERE store_id = $1
          ORDER BY name ASC
        `,
        [DEFAULT_STORE_ID]
      ),
      query(
        `
          SELECT MAX(updated_at) AS "lastSyncTime"
          FROM products
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      )
    ]);

    res.json({
      inventory: inventoryResult.rows.map((row) => ({
        storeId: row.storeId,
        productId: Number(row.productId),
        name: row.name,
        barcode: row.barcode,
        stock: Number(row.stock),
        updatedAt: row.updatedAt
      })),
      lastSyncTime: syncResult.rows[0]?.lastSyncTime || null
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
