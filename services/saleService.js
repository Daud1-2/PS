const { getDatabase } = require('../database/db');
const { getAppConfig } = require('../config/appConfig');
const { getOpenShiftRecord, ShiftError } = require('./shiftService');

function getDefaultStoreId() {
  return getAppConfig().storeId;
}

class CheckoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckoutError';
  }
}

function normalizeCartItems(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new CheckoutError('Cart is empty. Add items before checkout.');
  }

  const quantitiesByProductId = new Map();

  for (const item of cartItems) {
    const productId = Number(item?.product_id);
    const quantity = Number.parseInt(String(item?.quantity ?? ''), 10);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new CheckoutError('Cart contains an invalid product.');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CheckoutError('Cart contains an invalid quantity.');
    }

    quantitiesByProductId.set(
      productId,
      (quantitiesByProductId.get(productId) || 0) + quantity
    );
  }

  return Array.from(quantitiesByProductId.entries()).map(
    ([productId, quantity]) => ({
      product_id: productId,
      quantity
    })
  );
}

function createSale(cartItems) {
  const db = getDatabase();
  const normalizedCart = normalizeCartItems(cartItems);

  const selectProduct = db.prepare(`
    SELECT
      id,
      cloud_product_id AS cloudProductId,
      name,
      barcode,
      stock,
      cost_price AS costPrice,
      selling_price AS sellingPrice,
      catalog_updated_at AS catalogUpdatedAt,
      stock_updated_at AS stockUpdatedAt,
      created_source AS createdSource
    FROM products
    WHERE id = ?
  `);

  const insertSale = db.prepare(`
    INSERT INTO sales (
      store_id,
      shift_id,
      total_amount,
      total_cost,
      created_at,
      sync_status
    )
    VALUES (@storeId, @shiftId, @totalAmount, @totalCost, @createdAt, 'pending')
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_price)
    VALUES (@saleId, @productId, @quantity, @price, @costPrice)
  `);

  const updateProductStock = db.prepare(`
    UPDATE products
    SET stock = stock - @quantity,
        stock_updated_at = @stockUpdatedAt
    WHERE id = @productId
  `);

  const fetchSale = db.prepare(`
    SELECT
      id,
      store_id AS storeId,
      total_amount AS totalAmount,
      total_cost AS totalCost,
      shift_id AS shiftId,
      created_at AS createdAt,
      sync_status AS syncStatus,
      synced_at AS syncedAt
    FROM sales
    WHERE id = ?
  `);

  const checkoutTransaction = db.transaction((items) => {
    const openShift = getOpenShiftRecord(db);

    if (!openShift) {
      throw new ShiftError('Start a shift before checkout.');
    }

    const stockUpdatedAt = new Date().toISOString();
    const saleLines = items.map((item) => {
      const product = selectProduct.get(item.product_id);

      if (!product) {
        throw new CheckoutError(`Product ${item.product_id} no longer exists.`);
      }

      const sellingPrice = Number(product.sellingPrice);
      const costPrice = Number.isFinite(Number(product.costPrice))
        ? Number(product.costPrice)
        : 0;

      if (!Number.isFinite(sellingPrice)) {
        throw new CheckoutError(`${product.name} needs a selling price before checkout.`);
      }

      if (product.stock < item.quantity) {
        throw new CheckoutError(
          `${product.name} only has ${product.stock} in stock.`
        );
      }

      return {
        localProductId: Number(product.id),
        cloudProductId:
          product.cloudProductId === null || product.cloudProductId === undefined
            ? null
            : Number(product.cloudProductId),
        name: product.name,
        barcode: product.barcode,
        quantity: item.quantity,
        price: sellingPrice,
        costPrice,
        stockAfterSale: Number(product.stock) - item.quantity,
        total: sellingPrice * item.quantity,
        catalogUpdatedAt: product.catalogUpdatedAt,
        stockUpdatedAt,
        createdSource: product.createdSource
      };
    });

    const totals = saleLines.reduce(
      (summary, line) => {
        summary.totalAmount += line.price * line.quantity;
        summary.totalCost += line.costPrice * line.quantity;
        return summary;
      },
      { totalAmount: 0, totalCost: 0 }
    );

    const createdAt = new Date().toISOString();
    const appConfig = getAppConfig();
    const saleInsertResult = insertSale.run({
      storeId: getDefaultStoreId(),
      shiftId: Number(openShift.id),
      totalAmount: totals.totalAmount,
      totalCost: totals.totalCost,
      createdAt
    });

    const saleId = saleInsertResult.lastInsertRowid;

    for (const line of saleLines) {
      insertSaleItem.run({
        saleId,
        productId: line.localProductId,
        quantity: line.quantity,
        price: line.price,
        costPrice: line.costPrice
      });

      updateProductStock.run({
        productId: line.localProductId,
        quantity: line.quantity,
        stockUpdatedAt
      });
    }

    const sale = fetchSale.get(saleId);
    const receiptItems = saleLines.map((line) => ({
      productId: line.localProductId,
      name: line.name,
      price: line.price,
      qty: line.quantity,
      total: line.total
    }));
    const receipt = {
      storeName: appConfig.storeName,
      dateTime: sale.createdAt,
      items: receiptItems,
      totalAmount: Number(sale.totalAmount),
      footerMessage: appConfig.receiptFooterMessage
    };
    const syncPayload = {
      sale: {
        saleId: Number(sale.id),
        posSaleId: Number(sale.id),
        storeId: sale.storeId,
        shiftId: sale.shiftId === null ? null : Number(sale.shiftId),
        totalAmount: Number(sale.totalAmount),
        totalCost: Number(sale.totalCost),
        createdAt: sale.createdAt,
        syncStatus: sale.syncStatus,
        syncedAt: sale.syncedAt
      },
      items: saleLines.map((line) => ({
        saleId: Number(sale.id),
        storeId: sale.storeId,
        localProductId: line.localProductId,
        cloudProductId: line.cloudProductId,
        productName: line.name,
        barcode: line.barcode,
        quantity: line.quantity,
        price: line.price,
        costPrice: line.costPrice,
        stock: line.stockAfterSale,
        total: line.total,
        catalogUpdatedAt: line.catalogUpdatedAt,
        stockUpdatedAt: line.stockUpdatedAt,
        createdSource: line.createdSource
      })),
      timestamp: sale.createdAt,
      storeId: sale.storeId
    };

    return {
      sale,
      receipt,
      syncPayload
    };
  });

  return checkoutTransaction(normalizedCart);
}

function getPendingSalesForSync(limit = 25) {
  const db = getDatabase();
  const pendingSales = db
    .prepare(`
      SELECT
        id,
        store_id AS storeId,
        shift_id AS shiftId,
        total_amount AS totalAmount,
        total_cost AS totalCost,
        created_at AS createdAt,
        sync_status AS syncStatus,
        synced_at AS syncedAt
      FROM sales
      WHERE sync_status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `)
    .all(Number(limit));

  if (pendingSales.length === 0) {
    return [];
  }

  const placeholders = pendingSales.map(() => '?').join(', ');
  const saleItems = db
    .prepare(`
      SELECT
        si.sale_id AS saleId,
        si.product_id AS localProductId,
        si.quantity,
        si.price,
        si.cost_price AS costPrice,
        p.cloud_product_id AS cloudProductId,
        p.name AS productName,
        p.barcode,
        p.stock,
        p.catalog_updated_at AS catalogUpdatedAt,
        p.stock_updated_at AS stockUpdatedAt,
        p.created_source AS createdSource
      FROM sale_items si
      INNER JOIN products p ON p.id = si.product_id
      WHERE si.sale_id IN (${placeholders})
      ORDER BY si.sale_id ASC, si.id ASC
    `)
    .all(...pendingSales.map((sale) => sale.id));

  return pendingSales.map((sale) => {
    const items = saleItems
      .filter((item) => item.saleId === sale.id)
      .map((item) => ({
        localProductId: Number(item.localProductId),
        cloudProductId:
          item.cloudProductId === null || item.cloudProductId === undefined
            ? null
            : Number(item.cloudProductId),
        productName: item.productName,
        barcode: item.barcode,
        quantity: Number(item.quantity),
        price: Number(item.price),
        costPrice: Number(item.costPrice),
        stock: Number(item.stock),
        catalogUpdatedAt: item.catalogUpdatedAt,
        stockUpdatedAt: item.stockUpdatedAt,
        createdSource: item.createdSource
      }));

    return {
      sale: {
        saleId: Number(sale.id),
        posSaleId: Number(sale.id),
        storeId: sale.storeId,
        shiftId: sale.shiftId === null ? null : Number(sale.shiftId),
        totalAmount: Number(sale.totalAmount),
        totalCost: Number(sale.totalCost),
        createdAt: sale.createdAt,
        syncStatus: sale.syncStatus,
        syncedAt: sale.syncedAt
      },
      items,
      timestamp: sale.createdAt,
      storeId: sale.storeId
    };
  });
}

function markSaleSynced(saleId, syncedAt = new Date().toISOString()) {
  const db = getDatabase();

  db.prepare(`
    UPDATE sales
    SET sync_status = 'synced',
        synced_at = @syncedAt
    WHERE id = @saleId
  `).run({
    saleId: Number(saleId),
    syncedAt
  });

  return {
    saleId: Number(saleId),
    syncedAt
  };
}

module.exports = {
  DEFAULT_STORE_ID: getDefaultStoreId,
  createSale,
  getPendingSalesForSync,
  markSaleSynced,
  CheckoutError
};
