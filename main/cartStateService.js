const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getCartStatePath() {
  return path.join(app.getPath('userData'), 'cart-state.json');
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
    updatedAt: new Date().toISOString()
  };
}

async function saveCartState(state) {
  const normalizedState = normalizeCartState(state);
  const filePath = getCartStatePath();
  const tempPath = `${filePath}.tmp`;

  await fs.promises.writeFile(tempPath, JSON.stringify(normalizedState), 'utf8');
  await fs.promises.rename(tempPath, filePath);

  return normalizedState;
}

async function loadCartState() {
  const filePath = getCartStatePath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = await fs.promises.readFile(filePath, 'utf8');
  const parsed = JSON.parse(fileContents);
  const normalized = normalizeCartState(parsed);

  return normalized.cart.length > 0 ? normalized : null;
}

async function clearCartState() {
  const filePath = getCartStatePath();

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }

  return {
    cleared: true
  };
}

module.exports = {
  saveCartState,
  loadCartState,
  clearCartState
};
