const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posAPI', {
  getProduct(barcode) {
    return ipcRenderer.invoke('products:get-by-barcode', barcode);
  },
  searchProducts(query) {
    return ipcRenderer.invoke('products:search', query);
  },
  checkout(cartItems) {
    return ipcRenderer.invoke('sales:checkout', cartItems);
  },
  printReceipt(receipt) {
    return ipcRenderer.invoke('printer:print-receipt', receipt);
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
  refreshProducts() {
    return ipcRenderer.invoke('sync:refresh-products');
  }
});
