import React, { useEffect, useMemo, useRef, useState } from 'react';
import BarcodeInput from './components/BarcodeInput.jsx';
import CartTable from './components/CartTable.jsx';
import Checkout from './components/Checkout.jsx';
import ProductCompletionModal from './components/ProductCompletionModal.jsx';
import ProductGrid from './components/ProductGrid.jsx';
import QuickAddProduct from './components/QuickAddProduct.jsx';
import ShiftModal from './components/ShiftModal.jsx';
import { printLastReceipt } from './components/PrintService.js';
import Sidebar from './layout/Sidebar.jsx';
import Products from './pages/Products.jsx';

const HELD_SALE_STORAGE_KEY = 'pos-held-sale-state';

function hasProductSellingPrice(product) {
  return (
    product?.sellingPrice !== null &&
    product?.sellingPrice !== undefined &&
    Number.isFinite(Number(product.sellingPrice))
  );
}

function getProductSellingPrice(product) {
  if (!hasProductSellingPrice(product)) {
    throw new Error('Product needs a selling price before it can be added to the cart.');
  }

  return Number(product.sellingPrice);
}

function getProductCostPrice(product) {
  if (
    product?.costPrice === null ||
    product?.costPrice === undefined ||
    !Number.isFinite(Number(product.costPrice))
  ) {
    return 0;
  }

  return Number(product.costPrice);
}

function normalizeProduct(product) {
  return {
    product_id: product.id,
    name: product.name,
    price: getProductSellingPrice(product),
    cost_price: getProductCostPrice(product),
    quantity: 1
  };
}

function calculateTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatCurrency(value) {
  return `PKR ${Number(value || 0).toFixed(2)}`;
}

function sortProductsByName(products) {
  return [...products].sort((left, right) =>
    String(left.name || '').localeCompare(String(right.name || ''))
  );
}

function upsertProduct(products, product) {
  const existingIndex = products.findIndex((item) => item.id === product.id);

  if (existingIndex === -1) {
    return [...products, product];
  }

  const nextProducts = [...products];
  nextProducts[existingIndex] = product;
  return nextProducts;
}

function getStatusStyles(tone) {
  if (tone === 'success') {
    return {
      backgroundColor: 'rgba(49, 182, 122, 0.14)',
      borderColor: 'rgba(49, 182, 122, 0.18)',
      color: '#eafaf2'
    };
  }

  if (tone === 'error') {
    return {
      backgroundColor: 'rgba(244, 114, 182, 0.16)',
      borderColor: 'rgba(244, 114, 182, 0.2)',
      color: '#fff1f5'
    };
  }

  return {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#f4efe6'
  };
}

function normalizeSaleState(state) {
  return {
    cart: Array.isArray(state?.cart) ? state.cart : [],
    stockByProductId:
      state?.stockByProductId && typeof state.stockByProductId === 'object'
        ? state.stockByProductId
        : {},
    itemCount:
      state?.itemCount ??
      (Array.isArray(state?.cart)
        ? state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : 0),
    totalAmount:
      state?.totalAmount ??
      (Array.isArray(state?.cart)
        ? state.cart.reduce(
            (sum, item) =>
              sum + Number(item.price || 0) * Number(item.quantity || 0),
            0
          )
        : 0),
    updatedAt: state?.updatedAt || new Date().toISOString()
  };
}

async function saveHeldSaleStateClient(state) {
  const normalizedState = normalizeSaleState(state);

  if (typeof window.posAPI?.saveHeldSaleState === 'function') {
    try {
      return await window.posAPI.saveHeldSaleState(normalizedState);
    } catch (error) {
      console.warn('Falling back to local held-sale storage:', error);
    }
  }

  window.localStorage.setItem(
    HELD_SALE_STORAGE_KEY,
    JSON.stringify(normalizedState)
  );
  return normalizedState;
}

async function loadHeldSaleStateClient() {
  if (typeof window.posAPI?.loadHeldSaleState === 'function') {
    try {
      return await window.posAPI.loadHeldSaleState();
    } catch (error) {
      console.warn('Falling back to local held-sale restore:', error);
    }
  }

  const rawState = window.localStorage.getItem(HELD_SALE_STORAGE_KEY);

  if (!rawState) {
    return null;
  }

  try {
    return normalizeSaleState(JSON.parse(rawState));
  } catch (error) {
    console.error('Unable to parse held sale from local storage:', error);
    window.localStorage.removeItem(HELD_SALE_STORAGE_KEY);
    return null;
  }
}

async function clearHeldSaleStateClient() {
  if (typeof window.posAPI?.clearHeldSaleState === 'function') {
    try {
      return await window.posAPI.clearHeldSaleState();
    } catch (error) {
      console.warn('Falling back to local held-sale clear:', error);
    }
  }

  window.localStorage.removeItem(HELD_SALE_STORAGE_KEY);
  return { cleared: true };
}

export default function App() {
  const barcodeInputRef = useRef(null);
  const cartRef = useRef([]);
  const [activeView, setActiveView] = useState('pos');
  const [cart, setCart] = useState([]);
  const [stockByProductId, setStockByProductId] = useState({});
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [activeShift, setActiveShift] = useState(null);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [isShiftSubmitting, setIsShiftSubmitting] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState('open');
  const [shiftClosingSummary, setShiftClosingSummary] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Ready for barcode scan');
  const [statusTone, setStatusTone] = useState('neutral');
  const [lastItemLabel, setLastItemLabel] = useState('');
  const [lastScannedProductId, setLastScannedProductId] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [lastSyncPayload, setLastSyncPayload] = useState(null);
  const [printStatus, setPrintStatus] = useState('idle');
  const [backupStatus, setBackupStatus] = useState('idle');
  const [hasLoadedCartState, setHasLoadedCartState] = useState(false);
  const [heldSaleState, setHeldSaleState] = useState(null);
  const [quickAddBarcode, setQuickAddBarcode] = useState('');
  const [productCompletionTarget, setProductCompletionTarget] = useState(null);
  const [productsRefreshToken, setProductsRefreshToken] = useState(0);
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    currentVersion: '',
    availableVersion: null,
    downloadedVersion: null,
    progressPercent: 0,
    message: ''
  });

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    let isMounted = true;

    async function restoreUpdateState() {
      try {
        const nextState = await window.posAPI.getUpdateState();

        if (isMounted && nextState) {
          setUpdateState(nextState);
        }
      } catch (error) {
        console.error('Failed to restore update state:', error);
      }
    }

    void restoreUpdateState();

    const unsubscribe =
      typeof window.posAPI?.onUpdateStateChanged === 'function'
        ? window.posAPI.onUpdateStateChanged((nextState) => {
            if (isMounted && nextState) {
              setUpdateState(nextState);
            }
          })
        : () => {};

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (lastScannedProductId === null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setLastScannedProductId(null);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastScannedProductId]);

  useEffect(() => {
    let isMounted = true;

    async function restoreCartState() {
      try {
        const savedState = await window.posAPI.loadCartState();

        if (!isMounted) {
          return;
        }

        if (savedState?.cart?.length) {
          cartRef.current = savedState.cart;
          setCart(savedState.cart);
          setStockByProductId(savedState.stockByProductId || {});
          setLastItemLabel(savedState.cart[0]?.name || '');
          setStatusMessage(
            `Restored ${savedState.cart.length} item(s) after the last session`
          );
          setStatusTone('success');
        }
      } catch (error) {
        console.error('Failed to restore cart state:', error);
      } finally {
        if (isMounted) {
          setHasLoadedCartState(true);
        }
      }
    }

    void restoreCartState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreHeldSaleState() {
      try {
        const savedHeldSale = await loadHeldSaleStateClient();

        if (isMounted) {
          setHeldSaleState(savedHeldSale);
        }
      } catch (error) {
        console.error('Failed to restore held sale state:', error);
      }
    }

    void restoreHeldSaleState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreOpenShift() {
      setIsShiftLoading(true);

      try {
        const openShift = await window.posAPI.getOpenShift();

        if (!isMounted) {
          return;
        }

        setActiveShift(openShift);
        setIsShiftModalOpen(!openShift);
        setShiftModalMode('open');
        setShiftClosingSummary(null);
      } catch (error) {
        console.error('Failed to restore open shift:', error);

        if (!isMounted) {
          return;
        }

        setActiveShift(null);
        setIsShiftModalOpen(true);
        setShiftModalMode('open');
      } finally {
        if (isMounted) {
          setIsShiftLoading(false);
        }
      }
    }

    void restoreOpenShift();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedCartState) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const action = cart.length
        ? window.posAPI.saveCartState({
            cart,
            stockByProductId
          })
        : window.posAPI.clearCartState();

      Promise.resolve(action).catch((error) => {
        console.error('Unable to persist cart state:', error);
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cart, stockByProductId, hasLoadedCartState]);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalogProducts() {
      setIsCatalogLoading(true);
      setCatalogError('');

      try {
        const products = await window.posAPI.listProducts('');

        if (!isMounted) {
          return;
        }

        setCatalogProducts(products);
      } catch (error) {
        console.error('Unable to load POS products:', error);

        if (!isMounted) {
          return;
        }

        setCatalogProducts([]);
        setCatalogError(error?.message || 'Unable to load products right now');
      } finally {
        if (isMounted) {
          setIsCatalogLoading(false);
        }
      }
    }

    void loadCatalogProducts();

    return () => {
      isMounted = false;
    };
  }, [productsRefreshToken]);

  const totalAmount = useMemo(() => calculateTotal(cart), [cart]);
  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const focusBarcodeInput = () => {
    window.requestAnimationFrame(() => {
      barcodeInputRef.current?.focus?.({ preventScroll: true });
    });
  };

  const persistActiveSaleState = async (state) => {
    const normalizedState = normalizeSaleState(state);

    if (normalizedState.cart.length > 0) {
      await window.posAPI.saveCartState({
        cart: normalizedState.cart,
        stockByProductId: normalizedState.stockByProductId
      });
      return;
    }

    await window.posAPI.clearCartState();
  };

  const applyActiveSaleState = (state) => {
    const normalizedState = normalizeSaleState(state);
    const nextCart = normalizedState.cart;
    const nextStock = normalizedState.stockByProductId;

    cartRef.current = nextCart;
    setCart(nextCart);
    setStockByProductId(nextStock);
    setLastScannedProductId(null);
    setLastSyncPayload(null);
    setPrintStatus('idle');
    setBackupStatus('idle');
    setLastItemLabel(nextCart[0]?.name || '');
    clearQuickAdd();
  };

  const showStatus = (message, tone) => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const refreshOpenShift = async () => {
    const openShift = await window.posAPI.getOpenShift();
    setActiveShift(openShift);
    return openShift;
  };

  const handleStartShift = async (openingCash) => {
    setIsShiftSubmitting(true);

    try {
      const nextShift = await window.posAPI.startShift(openingCash);
      setActiveShift(nextShift);
      setShiftClosingSummary(null);
      setShiftModalMode('open');
      setIsShiftModalOpen(false);
      showStatus(
        `Shift #${nextShift.id} opened with ${formatCurrency(nextShift.openingCash)}`,
        'success'
      );
      focusBarcodeInput();
    } finally {
      setIsShiftSubmitting(false);
    }
  };

  const handleRequestCloseShift = async () => {
    if (!activeShift) {
      showStatus('There is no active shift to close.', 'error');
      return;
    }

    if (cartRef.current.length > 0) {
      showStatus('Clear the current cart before ending the shift.', 'error');
      return;
    }

    setIsShiftSubmitting(true);

    try {
      const summary = await window.posAPI.getShiftClosingSummary(activeShift.id);
      setShiftClosingSummary(summary);
      setShiftModalMode('close');
      setIsShiftModalOpen(true);
    } catch (error) {
      console.error('Unable to prepare shift close summary:', error);
      showStatus(error?.message || 'Unable to load shift totals right now.', 'error');
    } finally {
      setIsShiftSubmitting(false);
    }
  };

  const handleCloseShift = async (actualCash) => {
    setIsShiftSubmitting(true);

    try {
      const result = await window.posAPI.closeShift(actualCash);
      setActiveShift(null);
      setShiftClosingSummary(result);
      setShiftModalMode('open');
      setIsShiftModalOpen(true);
      showStatus(`Shift #${result.shift.id} closed successfully.`, 'success');
    } finally {
      setIsShiftSubmitting(false);
    }
  };

  const markProductsChanged = () => {
    setProductsRefreshToken((current) => current + 1);
  };

  const syncProductIntoRuntime = (product) => {
    const nextStock = Number(product.stock ?? 0);

    setCatalogProducts((current) => upsertProduct(current, product));
    setStockByProductId((current) => ({
      ...current,
      [product.id]: nextStock
    }));

    setCart((current) => {
      if (!current.some((item) => item.product_id === product.id)) {
        cartRef.current = current;
        return current;
      }

      const nextCart = current.map((item) => {
        if (item.product_id !== product.id) {
          return item;
        }

        return {
          ...item,
          name: product.name,
          price: hasProductSellingPrice(product)
            ? getProductSellingPrice(product)
            : item.price,
          cost_price: getProductCostPrice(product)
        };
      });

      cartRef.current = nextCart;
      return nextCart;
    });
  };

  const clearQuickAdd = () => {
    setQuickAddBarcode('');
    barcodeInputRef.current?.clearMissState?.();
  };

  const openProductCompletion = (product, label = product.barcode || product.name) => {
    clearQuickAdd();
    setProductCompletionTarget({
      product,
      label
    });
    setLastItemLabel(label);
    setLastScannedProductId(null);
    setLastSyncPayload(null);
    setPrintStatus('idle');
    setBackupStatus('idle');
    showStatus(`Complete product info for ${product.name}`, 'neutral');
  };

  const resetActiveSaleState = () => {
    cartRef.current = [];
    setCart([]);
    setStockByProductId({});
    setLastScannedProductId(null);
    setLastSyncPayload(null);
    setPrintStatus('idle');
    clearQuickAdd();
    setLastItemLabel('');
  };

  const clearCart = (message = 'Cart cleared') => {
    resetActiveSaleState();
    void window.posAPI.clearCartState().catch((error) => {
      console.error('Unable to clear saved cart state:', error);
    });
    showStatus(message, 'neutral');
    focusBarcodeInput();
  };

  const handleHoldSale = async () => {
    if (isCheckingOut || isPrintingReceipt || isBackingUp) {
      return;
    }

    if (cartRef.current.length === 0) {
      if (!heldSaleState?.cart?.length) {
        showStatus('No held sale available', 'neutral');
        focusBarcodeInput();
        return;
      }

      applyActiveSaleState(heldSaleState);
      setHeldSaleState(null);

      try {
        await clearHeldSaleStateClient();
        await persistActiveSaleState(heldSaleState);
        showStatus(
          `Resumed held sale with ${heldSaleState.itemCount} item(s)`,
          'success'
        );
      } catch (error) {
        console.error('Unable to resume held sale:', error);
        showStatus('Held sale could not be resumed right now', 'error');
      } finally {
        focusBarcodeInput();
      }

      return;
    }

    const currentSaleState = {
      cart: cartRef.current,
      stockByProductId
    };

    try {
      if (heldSaleState?.cart?.length) {
        const previousHeldSale = heldSaleState;
        const savedHeldSale = await saveHeldSaleStateClient(currentSaleState);

        setHeldSaleState(savedHeldSale);
        applyActiveSaleState(previousHeldSale);
        await persistActiveSaleState(previousHeldSale);
        showStatus(
          `Swapped active sale with held sale (${previousHeldSale.itemCount} item(s))`,
          'success'
        );
      } else {
        const savedHeldSale = await saveHeldSaleStateClient(currentSaleState);

        setHeldSaleState(savedHeldSale);
        resetActiveSaleState();
        await persistActiveSaleState({ cart: [], stockByProductId: {} });
        showStatus(`Held current sale with ${savedHeldSale.itemCount} item(s)`, 'success');
      }
    } catch (error) {
      console.error('Unable to hold sale:', error);
      showStatus(error?.message || 'Unable to hold this sale right now', 'error');
    } finally {
      focusBarcodeInput();
    }
  };

  const addProductToCart = (product, label = product.name) => {
    const availableStock = Number(product.stock);
    const normalizedProduct = normalizeProduct(product);
    const currentCart = cartRef.current;
    const existingItem = currentCart.find(
      (item) => item.product_id === normalizedProduct.product_id
    );
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    setLastItemLabel(label);
    setLastSyncPayload(null);
    setPrintStatus('idle');
    setBackupStatus('idle');
    setStockByProductId((currentStock) => ({
      ...currentStock,
      [normalizedProduct.product_id]: availableStock
    }));

    if (availableStock <= 0) {
      const message = `${product.name} is out of stock.`;
      window.alert(message);
      showStatus(message, 'error');
      setLastScannedProductId(null);
      return false;
    }

    if (currentQuantity >= availableStock) {
      const message = `${product.name} only has ${availableStock} in stock.`;
      window.alert(message);
      showStatus(message, 'error');
      setLastScannedProductId(null);
      return false;
    }

    const nextCart = existingItem
      ? currentCart.map((item) => {
          if (item.product_id !== normalizedProduct.product_id) {
            return item;
          }

          return {
            ...item,
            quantity: item.quantity + 1
          };
        })
      : [...currentCart, normalizedProduct];

    cartRef.current = nextCart;
    setCart(nextCart);
    showStatus(`Scanned ${product.name} successfully`, 'success');
    setLastScannedProductId(null);
    window.requestAnimationFrame(() => {
      setLastScannedProductId(normalizedProduct.product_id);
    });

    return true;
  };

  const createProduct = async (payload) => {
    const product = await window.posAPI.addProduct(payload);
    markProductsChanged();
    syncProductIntoRuntime(product);
    return product;
  };

  const updateProduct = async (productId, payload, options) => {
    const product = await window.posAPI.updateProduct(productId, payload, options);
    markProductsChanged();
    syncProductIntoRuntime(product);
    return product;
  };

  const removeProductFromRuntime = (productId) => {
    setCatalogProducts((current) =>
      current.filter((product) => product.id !== productId)
    );
    setStockByProductId((current) => {
      if (!(productId in current)) {
        return current;
      }

      const nextStock = { ...current };
      delete nextStock[productId];
      return nextStock;
    });

    setCart((current) => {
      const nextCart = current.filter((item) => item.product_id !== productId);
      cartRef.current = nextCart;
      return nextCart;
    });

    setLastScannedProductId((current) => (current === productId ? null : current));
  };

  const deleteProduct = async (productId) => {
    const product = await window.posAPI.deleteProduct(productId);
    markProductsChanged();
    removeProductFromRuntime(productId);
    return product;
  };

  const handleProductSelected = (product, label = product.name) => {
    clearQuickAdd();

    if (!hasProductSellingPrice(product)) {
      openProductCompletion(product, label);
      return false;
    }

    return addProductToCart(product, label);
  };

  const handleProductScanned = (product, barcode) => {
    return handleProductSelected(product, barcode);
  };

  const handleGridProductSelected = (product) => {
    const added = handleProductSelected(product, product.name);

    if (added) {
      showStatus(`Added ${product.name} from quick grid`, 'success');
      focusBarcodeInput();
    }
  };

  const handleQuickAddRequested = (barcode) => {
    setQuickAddBarcode(barcode);
    setLastItemLabel(barcode);
    showStatus(`No product found for ${barcode}`, 'error');
  };

  const handleQuickAddSaved = async (payload) => {
    const product = await createProduct(payload);
    const added = addProductToCart(product, product.barcode);

    clearQuickAdd();

    if (added) {
      showStatus(`Added ${product.name} and placed it in the cart`, 'success');
    }

    focusBarcodeInput();
    return product;
  };

  const handleProductCompletionSaved = async (payload) => {
    if (!productCompletionTarget?.product) {
      throw new Error('No product is pending completion.');
    }

    const completedProduct = await updateProduct(
      productCompletionTarget.product.id,
      payload,
      {
        partial: true
      }
    );
    const added = addProductToCart(
      completedProduct,
      productCompletionTarget.label || completedProduct.barcode
    );

    setProductCompletionTarget(null);

    if (added) {
      showStatus(`Completed ${completedProduct.name} and added it to the cart`, 'success');
    }

    focusBarcodeInput();
    return completedProduct;
  };

  const handleScanMiss = (barcode, error) => {
    setLastItemLabel(barcode);
    setLastScannedProductId(null);
    setLastSyncPayload(null);

    if (error) {
      console.error('Barcode lookup failed:', error);
      showStatus('Unable to look up product right now', 'error');
      return;
    }

    showStatus(`No product found for ${barcode}`, 'error');
  };

  const handleRemove = (productId) => {
    const nextCart = cartRef.current.filter((item) => item.product_id !== productId);
    cartRef.current = nextCart;
    setCart(nextCart);

    if (lastScannedProductId === productId) {
      setLastScannedProductId(null);
    }

    showStatus('Item removed from cart', 'neutral');
    setLastSyncPayload(null);
    setPrintStatus('idle');
    focusBarcodeInput();
  };

  const handleQuantityChange = (productId, qty) => {
    const parsedQuantity = Number.parseInt(String(qty).trim(), 10);

    if (!Number.isFinite(parsedQuantity)) {
      return;
    }

    const matchingItem = cartRef.current.find((item) => item.product_id === productId);

    if (!matchingItem) {
      return;
    }

    if (parsedQuantity <= 0) {
      handleRemove(productId);
      return;
    }

    const availableStock = stockByProductId[productId];

    if (Number.isFinite(availableStock) && parsedQuantity > availableStock) {
      const message = `${matchingItem.name} only has ${availableStock} in stock.`;
      window.alert(message);
      showStatus(message, 'error');
      focusBarcodeInput();
      return;
    }

    const nextCart = cartRef.current.map((item) => {
      if (item.product_id !== productId) {
        return item;
      }

      return {
        ...item,
        quantity: parsedQuantity
      };
    });

    cartRef.current = nextCart;
    setCart(nextCart);
    setLastSyncPayload(null);
    setPrintStatus('idle');
    showStatus(`Updated quantity for ${matchingItem.name}`, 'neutral');
  };

  const handlePrintReceipt = async (receipt, successMessage) => {
    setIsPrintingReceipt(true);

    try {
      await printLastReceipt(receipt);
      setPrintStatus('printed');
      showStatus(successMessage, 'success');
    } catch (error) {
      console.error('Receipt print failed:', error);
      const message =
        error?.message || 'Receipt printing failed. Check the printer and try again.';
      setPrintStatus('failed');
      window.alert(message);
      showStatus(message, 'error');
    } finally {
      setIsPrintingReceipt(false);
      focusBarcodeInput();
    }
  };

  const handleCheckout = async () => {
    if (isCheckingOut || isPrintingReceipt || isBackingUp) {
      return;
    }

    if (!activeShift) {
      setShiftModalMode('open');
      setShiftClosingSummary(null);
      setIsShiftModalOpen(true);
      showStatus('Start a shift before checkout.', 'error');
      return;
    }

    if (cartRef.current.length === 0) {
      showStatus('Cart is empty. Scan items before checkout.', 'error');
      return;
    }

    setIsCheckingOut(true);
    setPrintStatus('idle');

    try {
      const result = await window.posAPI.checkout(cartRef.current);
      resetActiveSaleState();
      setLastReceipt(result.receipt);
      setLastSyncPayload(result.syncPayload);
      setLastScannedProductId(null);
      setLastItemLabel(result.receipt.items[0]?.name || '');
      void window.posAPI.clearCartState().catch((error) => {
        console.error('Unable to clear saved cart state:', error);
      });
      showStatus(
        `Sale #${result.sale.id} saved for ${formatCurrency(result.sale.totalAmount)}`,
        'success'
      );

      await handlePrintReceipt(
        result.receipt,
        `Sale #${result.sale.id} completed and receipt printed`
      );
    } catch (error) {
      console.error('Checkout failed:', error);
      const message = error?.message || 'Checkout failed. Please try again.';
      window.alert(message);
      showStatus(message, 'error');
      focusBarcodeInput();
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleReprint = async () => {
    if (!lastReceipt || isPrintingReceipt || isCheckingOut) {
      return;
    }

    await handlePrintReceipt(lastReceipt, 'Receipt printed successfully');
  };

  const handleManualBackup = async () => {
    if (isBackingUp || isCheckingOut || isPrintingReceipt) {
      return;
    }

    setIsBackingUp(true);
    setBackupStatus('idle');

    try {
      await window.posAPI.backupDatabase();
      setBackupStatus('success');
      showStatus('Database backup saved successfully', 'success');
    } catch (error) {
      console.error('Backup failed:', error);
      setBackupStatus('error');
      showStatus(
        error?.message || 'Database backup failed. Check logs and try again.',
        'error'
      );
    } finally {
      setIsBackingUp(false);
      focusBarcodeInput();
    }
  };

  const handleOpenCashDrawer = async () => {
    if (isOpeningDrawer || isCheckingOut || isPrintingReceipt) {
      return;
    }

    setIsOpeningDrawer(true);

    try {
      if (typeof window.posAPI?.openCashDrawer === 'function') {
        await window.posAPI.openCashDrawer();
      } else if (typeof window.posAPI?.printReceipt === 'function') {
        await window.posAPI.printReceipt({
          storeName: activeShift ? `Shift #${activeShift.id}` : 'Grocery POS',
          dateTime: new Date().toISOString(),
          items: [
            {
              name: ' ',
              qty: 1,
              price: 0,
              total: 0
            }
          ],
          totalAmount: 0,
          footerMessage: ' '
        });
      } else {
        throw new Error(
          'Cash drawer control is not available in this app session. Restart the app and try again.'
        );
      }

      showStatus('Cash drawer opened', 'success');
    } catch (error) {
      console.error('Cash drawer open failed:', error);
      showStatus(
        error?.message || 'Unable to open the cash drawer right now.',
        'error'
      );
    } finally {
      setIsOpeningDrawer(false);
      focusBarcodeInput();
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      const nextState = await window.posAPI.checkForUpdates();

      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      console.error('Unable to check for updates:', error);
      window.alert(error?.message || 'Unable to check for updates right now.');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.posAPI.installUpdate();
    } catch (error) {
      console.error('Unable to install update:', error);
      window.alert(error?.message || 'Unable to install the downloaded update.');
    }
  };

  useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if (activeView !== 'pos' || quickAddBarcode || productCompletionTarget) {
        return;
      }

      if (isCheckingOut || isPrintingReceipt || isBackingUp) {
        return;
      }

      const normalizedKey = String(event.key || event.code || '').toLowerCase();

      if (normalizedKey === 'f9') {
        event.preventDefault();
        event.stopPropagation();
        void handleCheckout();
      }

      if (normalizedKey === 'escape' || normalizedKey === 'esc') {
        event.preventDefault();
        event.stopPropagation();

        if (cartRef.current.length > 0) {
          clearCart();
        }
      }
    };

    document.addEventListener('keydown', handleWindowKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleWindowKeyDown, true);
    };
  }, [
    activeView,
    quickAddBarcode,
    productCompletionTarget,
    isCheckingOut,
    isPrintingReceipt,
    isBackingUp
  ]);

  const isSaleExpanded = cart.length > 0 || Boolean(heldSaleState?.itemCount);

  const posView = (
    <section style={styles.contentShell}>
      <header style={styles.posHeader}>
        <div style={styles.headingCopy}>
          <h1 style={styles.title}>Product Selection</h1>
          <p style={styles.subtitle}>
            Barcode-first checkout with a fast scrollable product list for manual
            selection.
          </p>
        </div>

        <div style={styles.headerStatusGroup}>
          <div
            style={{
              ...styles.shiftPill,
              ...(activeShift ? styles.shiftPillOpen : styles.shiftPillClosed)
            }}
          >
            {activeShift ? `Shift Open #${activeShift.id}` : 'No Active Shift'}
          </div>

          <div style={styles.scannerPill}>
            <span style={styles.scannerDot} />
            Scanner Ready
          </div>
        </div>
      </header>

      <BarcodeInput
        ref={barcodeInputRef}
        onProductScanned={handleProductScanned}
        onScanMiss={handleScanMiss}
        onQuickAddRequested={handleQuickAddRequested}
      />

      <section
        style={{
          ...styles.posBody,
          ...(isSaleExpanded ? styles.posBodyExpanded : styles.posBodyCompact)
        }}
      >
        <div style={styles.productsColumn}>
          {catalogError ? (
            <div style={styles.catalogError}>{catalogError}</div>
          ) : null}

        <section
          className="hidden-scrollbar"
          style={{
            ...styles.gridPanel,
            ...(isSaleExpanded ? styles.gridPanelExpanded : styles.gridPanelCompact)
            }}
          >
            <ProductGrid
              products={catalogProducts}
              isLoading={isCatalogLoading}
              variant="pos"
              title="Quick Product List"
              subtitle="Fast scrollable product list with real-time search and instant add."
              searchLabel="Search Products"
              searchPlaceholder="Type product name, barcode, or stock"
              highlightedProductId={lastScannedProductId}
              onProductClick={handleGridProductSelected}
            />
          </section>
        </div>

        <aside
          style={{
            ...styles.cartPanel,
            ...(isSaleExpanded ? styles.cartPanelExpanded : styles.cartPanelCompact)
          }}
        >
          <div style={styles.cartHeader}>
            <div>
              <div style={styles.cartTitle}>Current Sale</div>
              <div style={styles.cartSubtitle}>
                Products add instantly without interrupting checkout.
              </div>
            </div>

            <div style={styles.cartPills}>
              <button
                type="button"
                onClick={() => {
                  void handleRequestCloseShift();
                }}
                disabled={!activeShift || isShiftSubmitting}
                style={{
                  ...styles.endShiftButton,
                  ...(!activeShift || isShiftSubmitting
                    ? styles.endShiftButtonDisabled
                    : {})
                }}
              >
                End Shift
              </button>
              <div style={styles.itemsPill}>{totalItems} items</div>
              {heldSaleState?.itemCount ? (
                <div style={styles.heldPill}>Held {heldSaleState.itemCount}</div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              ...styles.statusPanel,
              ...getStatusStyles(statusTone)
            }}
          >
            <div style={styles.statusLabel}>Status</div>
            <div style={styles.statusMessage}>{statusMessage}</div>
            <div style={styles.statusMeta}>
              Last item: {lastItemLabel || 'Waiting for item'}
            </div>
            <div style={styles.statusMeta}>
              Sync:{' '}
              {lastSyncPayload
                ? `${lastSyncPayload.sale.syncStatus} payload ready`
                : 'Offline-safe, pending next checkout'}
            </div>
          </div>

          <CartTable
            tone="dark"
            items={cart}
            lastScannedProductId={lastScannedProductId}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
          />

          <Checkout
            tone="dark"
            totalAmount={totalAmount}
            totalItems={totalItems}
            checkoutDisabled={
              cart.length === 0 ||
              !activeShift ||
              isCheckingOut ||
              isPrintingReceipt ||
              isBackingUp ||
              isShiftLoading
            }
            clearDisabled={
              cart.length === 0 || isCheckingOut || isPrintingReceipt || isBackingUp
            }
            holdDisabled={
              isCheckingOut ||
              isPrintingReceipt ||
              isBackingUp ||
              (cart.length === 0 && !heldSaleState?.itemCount)
            }
            canReprint={Boolean(lastReceipt)}
            holdLabel={
              cart.length === 0
                ? 'Resume Held'
                : heldSaleState?.itemCount
                  ? 'Swap Held'
                  : 'Hold Sale'
            }
            isCheckingOut={isCheckingOut}
            isPrinting={isPrintingReceipt}
            isBackingUp={isBackingUp}
            isOpeningDrawer={isOpeningDrawer}
            printStatus={printStatus}
            backupStatus={backupStatus}
            onCheckout={handleCheckout}
            onHold={handleHoldSale}
            onClearCart={() => clearCart()}
            onReprint={handleReprint}
            onOpenDrawer={handleOpenCashDrawer}
            onBackup={handleManualBackup}
          />
        </aside>
      </section>
    </section>
  );

  const canShowUpdateBanner =
    updateState.status !== 'disabled' && Boolean(updateState.message);
  const canInstallUpdate = updateState.status === 'downloaded';
  const isUpdateBusy =
    updateState.status === 'checking' ||
    updateState.status === 'available' ||
    updateState.status === 'downloading';
  const updateButtonLabel = canInstallUpdate
    ? 'Install Update'
    : isUpdateBusy
      ? updateState.status === 'downloading'
        ? `Downloading ${Number(updateState.progressPercent || 0).toFixed(0)}%`
        : 'Checking...'
      : 'Check Updates';

  return (
    <main style={styles.page}>
      <div style={styles.layout}>
        <Sidebar activeView={activeView} onNavigate={setActiveView} />

        <section style={styles.mainPanel}>
          {canShowUpdateBanner ? (
            <section
              style={{
                ...styles.updateBanner,
                ...(canInstallUpdate ? styles.updateBannerReady : {}),
                ...(updateState.status === 'error' ? styles.updateBannerError : {})
              }}
            >
              <div style={styles.updateCopy}>
                <div style={styles.updateEyebrow}>
                  Version {updateState.currentVersion || 'Current'}
                </div>
                <div style={styles.updateMessage}>{updateState.message}</div>
              </div>

              <button
                type="button"
                onClick={canInstallUpdate ? handleInstallUpdate : handleCheckForUpdates}
                disabled={isUpdateBusy}
                style={{
                  ...styles.updateButton,
                  ...(canInstallUpdate ? styles.updateButtonReady : {}),
                  ...(isUpdateBusy ? styles.updateButtonDisabled : {})
                }}
              >
                {updateButtonLabel}
              </button>
            </section>
          ) : null}

          {activeView === 'pos' ? (
            posView
          ) : (
            <Products
              refreshToken={productsRefreshToken}
              onAddProduct={createProduct}
              onUpdateProduct={updateProduct}
              onDeleteProduct={deleteProduct}
            />
          )}
        </section>
      </div>

      <QuickAddProduct
        isOpen={Boolean(quickAddBarcode)}
        barcode={quickAddBarcode}
        onClose={() => {
          clearQuickAdd();
          focusBarcodeInput();
        }}
        onSave={handleQuickAddSaved}
      />

      <ProductCompletionModal
        isOpen={Boolean(productCompletionTarget)}
        product={productCompletionTarget?.product || null}
        onClose={() => {
          setProductCompletionTarget(null);
          focusBarcodeInput();
        }}
        onSave={handleProductCompletionSaved}
      />

      <ShiftModal
        isOpen={isShiftModalOpen}
        mode={shiftModalMode}
        shift={activeShift}
        summary={shiftClosingSummary}
        isSubmitting={isShiftSubmitting}
        canDismiss={shiftModalMode === 'close'}
        onClose={() => {
          if (shiftModalMode === 'close') {
            setIsShiftModalOpen(false);
            setShiftClosingSummary(null);
          }
        }}
        onSubmit={(amount) =>
          shiftModalMode === 'close'
            ? handleCloseShift(amount)
            : handleStartShift(amount)
        }
      />
    </main>
  );
}

const styles = {
  page: {
    height: '100vh',
    width: '100%',
    margin: 0,
    background: 'linear-gradient(180deg, #f7f4ec 0%, #efe8da 100%)',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    color: '#101828',
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  layout: {
    display: 'flex',
    height: '100%',
    width: '100%'
  },
  mainPanel: {
    flex: 1,
    minWidth: 0,
    height: '100vh',
    overflow: 'auto',
    padding: '20px',
    boxSizing: 'border-box'
  },
  updateBanner: {
    marginBottom: '16px',
    padding: '14px 16px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #eef4ff 0%, #f8fbff 100%)',
    border: '1px solid rgba(36, 87, 197, 0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap'
  },
  updateBannerReady: {
    background: 'linear-gradient(135deg, #ecfdf3 0%, #f7fff9 100%)',
    border: '1px solid rgba(34, 197, 94, 0.16)'
  },
  updateBannerError: {
    background: 'linear-gradient(135deg, #fff1f2 0%, #fff8f8 100%)',
    border: '1px solid rgba(244, 63, 94, 0.16)'
  },
  updateCopy: {
    display: 'grid',
    gap: '6px'
  },
  updateEyebrow: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#2457c5'
  },
  updateMessage: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#17312d'
  },
  updateButton: {
    minHeight: '42px',
    padding: '0 16px',
    borderRadius: '14px',
    border: '1px solid rgba(36, 87, 197, 0.18)',
    backgroundColor: '#ffffff',
    color: '#2457c5',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  updateButtonReady: {
    border: '1px solid rgba(22, 101, 52, 0.12)',
    backgroundColor: '#166534',
    color: '#ffffff'
  },
  updateButtonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed'
  },
  contentShell: {
    width: '100%',
    minHeight: 'calc(100vh - 40px)',
    padding: '8px',
    display: 'grid',
    gridTemplateRows: 'auto auto auto',
    alignContent: 'start',
    gap: '18px',
    boxSizing: 'border-box'
  },
  posHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '4px 4px 0'
  },
  headingCopy: {
    display: 'grid',
    gap: '6px'
  },
  headerStatusGroup: {
    display: 'grid',
    gap: '10px',
    justifyItems: 'end'
  },
  title: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.05,
    color: '#17312d'
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#667d75'
  },
  shiftPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: '1px solid transparent'
  },
  shiftPillOpen: {
    backgroundColor: 'rgba(49, 182, 122, 0.16)',
    borderColor: 'rgba(49, 182, 122, 0.18)',
    color: '#166534'
  },
  shiftPillClosed: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    borderColor: 'rgba(225, 29, 72, 0.14)',
    color: '#9f1239'
  },
  scannerPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(22, 48, 43, 0.08)',
    color: '#17312d',
    fontSize: '13px',
    fontWeight: 800
  },
  scannerDot: {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    backgroundColor: '#31b67a'
  },
  posBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 306px',
    gap: '18px',
    minHeight: 0
  },
  posBodyCompact: {
    alignItems: 'start'
  },
  posBodyExpanded: {
    minHeight: 'min(72vh, 920px)'
  },
  productsColumn: {
    display: 'grid',
    gap: '12px',
    minHeight: 0
  },
  catalogError: {
    padding: '14px 16px',
    borderRadius: '18px',
    backgroundColor: '#fff3f5',
    border: '1px solid rgba(225, 29, 72, 0.14)',
    color: '#be123c',
    fontSize: '13px',
    fontWeight: 700
  },
  gridPanel: {
    minHeight: 0,
    padding: '18px',
    borderRadius: '28px',
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(22, 48, 43, 0.08)',
    boxShadow: '0 18px 40px rgba(92, 74, 28, 0.08)',
    overflow: 'auto'
  },
  gridPanelCompact: {
    maxHeight: '520px'
  },
  gridPanelExpanded: {
    minHeight: '620px',
    maxHeight: 'calc(100vh - 280px)'
  },
  cartPanel: {
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr auto',
    gap: '14px',
    minHeight: 0,
    padding: '14px',
    borderRadius: '28px',
    background: 'linear-gradient(180deg, #17322d 0%, #132c27 100%)',
    boxShadow: '0 22px 48px rgba(22, 48, 43, 0.22)'
  },
  cartPanelCompact: {
    alignSelf: 'start'
  },
  cartPanelExpanded: {
    minHeight: '620px'
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start'
  },
  cartPills: {
    display: 'grid',
    gap: '8px',
    justifyItems: 'end'
  },
  endShiftButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '14px',
    border: '1px solid rgba(243, 177, 75, 0.2)',
    backgroundColor: 'rgba(243, 177, 75, 0.16)',
    color: '#f7d39a',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer'
  },
  endShiftButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  cartTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#f5f1e8'
  },
  cartSubtitle: {
    marginTop: '4px',
    fontSize: '11px',
    lineHeight: 1.5,
    color: '#9fbaaf'
  },
  itemsPill: {
    padding: '10px 12px',
    borderRadius: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#f5f1e8',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },
  heldPill: {
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: 'rgba(243, 177, 75, 0.16)',
    color: '#f7d39a',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  },
  statusPanel: {
    padding: '16px',
    borderRadius: '20px',
    border: '1px solid transparent',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
  },
  statusLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0.82
  },
  statusMessage: {
    marginTop: '8px',
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.3
  },
  statusMeta: {
    marginTop: '8px',
    fontSize: '11px',
    lineHeight: 1.45,
    opacity: 0.92
  }
};
