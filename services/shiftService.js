const { getDatabase } = require('../database/db');

class ShiftError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShiftError';
  }
}

function mapShiftRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: Number(record.id),
    startTime: record.start_time,
    endTime: record.end_time,
    openingCash: Number(record.opening_cash),
    closingCash:
      record.closing_cash === null || record.closing_cash === undefined
        ? null
        : Number(record.closing_cash),
    totalSales: Number(record.total_sales || 0),
    expectedCash: Number(record.expected_cash || 0),
    difference: Number(record.difference || 0),
    status: record.status
  };
}

function normalizeMoney(value, label) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new ShiftError(`${label} must be a valid positive amount.`);
  }

  return Number(numericValue.toFixed(2));
}

function getOpenShiftRecord(db = getDatabase()) {
  return db
    .prepare(
      `
        SELECT
          id,
          start_time,
          end_time,
          opening_cash,
          closing_cash,
          total_sales,
          expected_cash,
          difference,
          status
        FROM shifts
        WHERE status = 'open'
        ORDER BY start_time DESC
        LIMIT 1
      `
    )
    .get();
}

function getOpenShift() {
  return mapShiftRecord(getOpenShiftRecord());
}

function startShift(openingCash) {
  const db = getDatabase();
  const existingOpenShift = getOpenShiftRecord(db);

  if (existingOpenShift) {
    throw new ShiftError('A shift is already open.');
  }

  const normalizedOpeningCash = normalizeMoney(openingCash, 'Opening cash');
  const startTime = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO shifts (
          start_time,
          opening_cash,
          closing_cash,
          total_sales,
          expected_cash,
          difference,
          status
        )
        VALUES (
          @startTime,
          @openingCash,
          NULL,
          0,
          @openingCash,
          0,
          'open'
        )
      `
    )
    .run({
      startTime,
      openingCash: normalizedOpeningCash
    });

  return mapShiftRecord(
    db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid)
  );
}

function getClosingSummary(shiftId) {
  const db = getDatabase();
  const openShift = shiftId
    ? db.prepare('SELECT * FROM shifts WHERE id = ?').get(Number(shiftId))
    : getOpenShiftRecord(db);

  if (!openShift) {
    throw new ShiftError('No open shift is available.');
  }

  if (openShift.status !== 'open') {
    throw new ShiftError('This shift has already been closed.');
  }

  const totalSalesRecord = db
    .prepare(
      `
        SELECT COALESCE(SUM(total_amount), 0) AS totalSales
        FROM sales
        WHERE shift_id = ?
      `
    )
    .get(openShift.id);

  const totalSales = Number(totalSalesRecord?.totalSales || 0);
  const openingCash = Number(openShift.opening_cash || 0);
  const expectedCash = Number((openingCash + totalSales).toFixed(2));

  return {
    shift: mapShiftRecord(openShift),
    totalSales,
    expectedCash
  };
}

function closeShift(actualCash) {
  const db = getDatabase();
  const summary = getClosingSummary();
  const closingCash = normalizeMoney(actualCash, 'Closing cash');
  const endTime = new Date().toISOString();
  const difference = Number((closingCash - summary.expectedCash).toFixed(2));

  db.prepare(
    `
      UPDATE shifts
      SET
        end_time = @endTime,
        closing_cash = @closingCash,
        total_sales = @totalSales,
        expected_cash = @expectedCash,
        difference = @difference,
        status = 'closed'
      WHERE id = @shiftId
    `
  ).run({
    endTime,
    closingCash,
    totalSales: summary.totalSales,
    expectedCash: summary.expectedCash,
    difference,
    shiftId: summary.shift.id
  });

  return {
    shift: mapShiftRecord(
      db.prepare('SELECT * FROM shifts WHERE id = ?').get(summary.shift.id)
    ),
    totalSales: summary.totalSales,
    expectedCash: summary.expectedCash,
    closingCash,
    difference
  };
}

module.exports = {
  ShiftError,
  getOpenShift,
  getOpenShiftRecord,
  getClosingSummary,
  getShiftsForSync(limit = 250) {
    const db = getDatabase();
    const rows = db
      .prepare(
        `
          SELECT
            id,
            start_time,
            end_time,
            opening_cash,
            closing_cash,
            total_sales,
            expected_cash,
            difference,
            status
          FROM shifts
          ORDER BY start_time DESC
          LIMIT ?
        `
      )
      .all(Number(limit));

    return rows.map(mapShiftRecord);
  },
  startShift,
  closeShift
};
