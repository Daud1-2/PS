const express = require('express');
const { withTransaction } = require('../db');

const router = express.Router();
const DEFAULT_STORE_ID =
  String(process.env.DEFAULT_STORE_ID || process.env.STORE_ID || 'default-store').trim() ||
  'default-store';

router.post('/maintenance/reset-business-data', async (_req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const beforeSales = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM sales
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );
      const beforeShifts = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM shifts
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );
      const beforeProducts = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM products
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );

      await client.query(
        `
          DELETE FROM sale_items
          WHERE sale_id IN (
            SELECT id
            FROM sales
            WHERE store_id = $1
          )
        `,
        [DEFAULT_STORE_ID]
      );
      await client.query(
        `
          DELETE FROM sales
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );
      await client.query(
        `
          DELETE FROM shifts
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );

      const afterSales = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM sales
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );
      const afterShifts = await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM shifts
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      );

      return {
        storeId: DEFAULT_STORE_ID,
        before: {
          sales: Number(beforeSales.rows[0]?.total || 0),
          shifts: Number(beforeShifts.rows[0]?.total || 0),
          products: Number(beforeProducts.rows[0]?.total || 0)
        },
        after: {
          sales: Number(afterSales.rows[0]?.total || 0),
          shifts: Number(afterShifts.rows[0]?.total || 0),
          products: Number(beforeProducts.rows[0]?.total || 0)
        }
      };
    });

    res.json({
      reset: true,
      ...result,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
