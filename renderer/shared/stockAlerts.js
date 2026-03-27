export const VERY_LOW_STOCK_THRESHOLD = 20;

export function getStockAlertLevel(stock) {
  const normalizedStock = Number(stock || 0);

  if (normalizedStock <= 0) {
    return 'out';
  }

  if (normalizedStock <= VERY_LOW_STOCK_THRESHOLD) {
    return 'low';
  }

  return 'normal';
}

export function hasVeryLowStock(stock) {
  return getStockAlertLevel(stock) !== 'normal';
}

export function getStockAlertLabel(stock) {
  const alertLevel = getStockAlertLevel(stock);

  if (alertLevel === 'out') {
    return 'Out of stock';
  }

  if (alertLevel === 'low') {
    return 'Very low stock';
  }

  return 'In stock';
}
