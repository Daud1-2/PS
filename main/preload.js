const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posAPI', {
  getProduct(barcode) {
    return ipcRenderer.invoke('products:get-by-barcode', barcode);
  },
  searchProducts(query) {
    return ipcRenderer.invoke('products:search', query);
  },
  listProducts(query) {
    return ipcRenderer.invoke('products:list', query);
  },
  addProduct(product) {
    return ipcRenderer.invoke('products:add', product);
  },
  updateProduct(productId, product, options) {
    return ipcRenderer.invoke('products:update', productId, product, options);
  },
  deleteProduct(productId) {
    return ipcRenderer.invoke('products:delete', productId);
  },
  getOpenShift() {
    return ipcRenderer.invoke('shift:get-open');
  },
  startShift(openingCash) {
    return ipcRenderer.invoke('shift:start', openingCash);
  },
  getShiftClosingSummary(shiftId) {
    return ipcRenderer.invoke('shift:get-closing-summary', shiftId);
  },
  closeShift(actualCash) {
    return ipcRenderer.invoke('shift:close', actualCash);
  },
  checkout(cartItems) {
    return ipcRenderer.invoke('sales:checkout', cartItems);
  },
  printReceipt(receipt) {
    return ipcRenderer.invoke('printer:print-receipt', receipt);
  },
  openCashDrawer() {
    return ipcRenderer.invoke('printer:open-cash-drawer');
  },
  backupDatabase() {
    return ipcRenderer.invoke('backup:create');
  },
  saveCartState(state) {
    return ipcRenderer.invoke('cart-state:save', state);
  },
  loadCartState() {
    return ipcRenderer.invoke('cart-state:load');
  },
  clearCartState() {
    return ipcRenderer.invoke('cart-state:clear');
  },
  saveHeldSaleState(state) {
    return ipcRenderer.invoke('held-sale-state:save', state);
  },
  loadHeldSaleState() {
    return ipcRenderer.invoke('held-sale-state:load');
  },
  clearHeldSaleState() {
    return ipcRenderer.invoke('held-sale-state:clear');
  },
  refreshProducts() {
    return ipcRenderer.invoke('sync:refresh-products');
  }
});
