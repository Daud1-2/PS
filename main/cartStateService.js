const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getStatePath(fileName) {
  return path.join(app.getPath('userData'), fileName);
}

function buildSaleSummary(state) {
  const cart = Array.isArray(state?.cart) ? state.cart : [];
  const totalAmount = cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 0);
  }, 0);
  const itemCount = cart.reduce((sum, item) => {
    return sum + Number(item.quantity || 0);
  }, 0);

  return {
    itemCount,
    totalAmount
  };
}

function normalizeCartState(state) {
  const cart = Array.isArray(state?.cart) ? state.cart : [];
  const stockByProductId =
    state?.stockByProductId && typeof state.stockByProductId === 'object'
      ? state.stockByProductId
      : {};

  return {
    cart,
    stockByProductId,
    updatedAt: state?.updatedAt || new Date().toISOString(),
    ...buildSaleSummary({ cart })
  };
}

async function saveState(fileName, state) {
  const normalizedState = normalizeCartState(state);
  const filePath = getStatePath(fileName);
  const tempPath = `${filePath}.tmp`;

  await fs.promises.writeFile(tempPath, JSON.stringify(normalizedState), 'utf8');
  await fs.promises.rename(tempPath, filePath);

  return normalizedState;
}

async function loadState(fileName) {
  const filePath = getStatePath(fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = await fs.promises.readFile(filePath, 'utf8');
  const parsed = JSON.parse(fileContents);
  const normalized = normalizeCartState(parsed);

  return normalized.cart.length > 0 ? normalized : null;
}

async function clearState(fileName) {
  const filePath = getStatePath(fileName);

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }

  return {
    cleared: true
  };
}

async function saveCartState(state) {
  return saveState('cart-state.json', state);
}

async function loadCartState() {
  return loadState('cart-state.json');
}

async function clearCartState() {
  return clearState('cart-state.json');
}

async function saveHeldSaleState(state) {
  return saveState('held-sale-state.json', state);
}

async function loadHeldSaleState() {
  return loadState('held-sale-state.json');
}

async function clearHeldSaleState() {
  return clearState('held-sale-state.json');
}

module.exports = {
  saveCartState,
  loadCartState,
  clearCartState,
  saveHeldSaleState,
  loadHeldSaleState,
  clearHeldSaleState
};
