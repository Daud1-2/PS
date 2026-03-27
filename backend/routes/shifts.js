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

function normalizeMoney(value, label) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`${label} must be a valid amount.`);
  }

  return Number(numericValue.toFixed(2));
}

function normalizeShiftPayload(shift) {
  const shiftId = Number.parseInt(String(shift?.id ?? ''), 10);

  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    throw new Error('Invalid shift payload.');
  }

  const status = String(shift?.status || 'open').trim().toLowerCase();

  if (!['open', 'closed'].includes(status)) {
    throw new Error('Shift status is invalid.');
  }

  return {
    id: shiftId,
    startTime: parseTimestamp(shift?.startTime),
    endTime: shift?.endTime ? parseTimestamp(shift.endTime) : null,
    openingCash: normalizeMoney(shift?.openingCash, 'Opening cash'),
    closingCash:
      shift?.closingCash === null || shift?.closingCash === undefined
        ? null
        : normalizeMoney(shift.closingCash, 'Closing cash'),
    totalSales: normalizeMoney(shift?.totalSales, 'Total sales'),
    expectedCash: normalizeMoney(shift?.expectedCash, 'Expected cash'),
    difference: normalizeMoney(Math.abs(Number(shift?.difference || 0)), 'Difference') *
      Math.sign(Number(shift?.difference || 0) || 0),
    status
  };
}

function serializeShift(row) {
  return {
    id: Number(row.id),
    start_time: row.startTime,
    end_time: row.endTime,
    opening_cash: Number(row.openingCash || 0),
    closing_cash:
      row.closingCash === null || row.closingCash === undefined
        ? null
        : Number(row.closingCash),
    total_sales: Number(row.totalSales || 0),
    expected_cash: Number(row.expectedCash || 0),
    difference: Number(row.difference || 0),
    status: row.status
  };
}

router.get('/shifts', async (_req, res, next) => {
  try {
    const [shiftsResult, syncResult] = await Promise.all([
      query(
        `
          SELECT
            pos_shift_id AS id,
            start_time AS "startTime",
            end_time AS "endTime",
            opening_cash AS "openingCash",
            closing_cash AS "closingCash",
            total_sales AS "totalSales",
            expected_cash AS "expectedCash",
            difference,
            status
          FROM shifts
          WHERE store_id = $1
          ORDER BY start_time DESC
        `,
        [DEFAULT_STORE_ID]
      ),
      query(
        `
          SELECT MAX(received_at) AS "lastSyncTime"
          FROM shifts
          WHERE store_id = $1
        `,
        [DEFAULT_STORE_ID]
      )
    ]);

    res.json({
      shifts: shiftsResult.rows.map(serializeShift),
      lastSyncTime: syncResult.rows[0]?.lastSyncTime || null
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sync/shifts', async (req, res, next) => {
  const incomingShifts = Array.isArray(req.body?.shifts) ? req.body.shifts : [];

  if (incomingShifts.length === 0) {
    res.status(400).json({
      error: 'No shifts provided for sync.'
    });
    return;
  }

  try {
    const syncedShifts = await withTransaction(async (client) => {
      const results = [];

      for (const shift of incomingShifts) {
        const normalizedShift = normalizeShiftPayload(shift);

        const result = await client.query(
          `
            INSERT INTO shifts (
              store_id,
              pos_shift_id,
              start_time,
              end_time,
              opening_cash,
              closing_cash,
              total_sales,
              expected_cash,
              difference,
              status,
              received_at
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
              NOW()
            )
            ON CONFLICT (store_id, pos_shift_id)
            DO UPDATE SET
              start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time,
              opening_cash = EXCLUDED.opening_cash,
              closing_cash = EXCLUDED.closing_cash,
              total_sales = EXCLUDED.total_sales,
              expected_cash = EXCLUDED.expected_cash,
              difference = EXCLUDED.difference,
              status = EXCLUDED.status,
              received_at = NOW()
            RETURNING pos_shift_id AS id
          `,
          [
            DEFAULT_STORE_ID,
            normalizedShift.id,
            normalizedShift.startTime,
            normalizedShift.endTime,
            normalizedShift.openingCash,
            normalizedShift.closingCash === null || normalizedShift.closingCash === undefined
              ? null
              : normalizedShift.closingCash,
            normalizedShift.totalSales,
            normalizedShift.expectedCash,
            normalizedShift.difference,
            normalizedShift.status
          ]
        );

        results.push({
          id: Number(result.rows[0].id)
        });
      }

      return results;
    });

    res.json({
      syncedShifts
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
