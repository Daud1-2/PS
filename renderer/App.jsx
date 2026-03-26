import React, { useEffect, useMemo, useRef, useState } from 'react';
import BarcodeInput from './components/BarcodeInput.jsx';
import CartTable from './components/CartTable.jsx';
import Checkout from './components/Checkout.jsx';
import ManualSearch from './components/ManualSearch.jsx';
import { printLastReceipt } from './components/PrintService.js';

function normalizeProduct(product) {
  return {
    product_id: product.id,
    name: product.name,
    price: Number(product.sellingPrice),
    cost_price: Number(product.costPrice),
    quantity: 1
  };
}

function calculateTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function getStatusStyles(tone) {
  if (tone === 'success') {
    return {
      backgroundColor: '#ecfdf3',
      borderColor: 'rgba(34, 197, 94, 0.18)',
      color: '#166534'
    };
  }

  if (tone === 'error') {
    return {
      backgroundColor: '#fef2f2',
      borderColor: 'rgba(239, 68, 68, 0.18)',
      color: '#b42318'
    };
  }

  return {
    backgroundColor: '#f8fafc',
    borderColor: 'rgba(16, 24, 40, 0.08)',
    color: '#475467'
  };
}

export default function App() {
  const barcodeInputRef = useRef(null);
  const manualSearchRef = useRef(null);
  const cartRef = useRef([]);
  const [cart, setCart] = useState([]);
  const [stockByProductId, setStockByProductId] = useState({});
  const [statusMessage, setStatusMessage] = useState('Ready for barcode scan');
  const [statusTone, setStatusTone] = useState('neutral');
  const [lastItemLabel, setLastItemLabel] = useState('');
  const [lastScannedProductId, setLastScannedProductId] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [lastSyncPayload, setLastSyncPayload] = useState(null);
  const [printStatus, setPrintStatus] = useState('idle');
  const [backupStatus, setBackupStatus] = useState('idle');
  const [hasLoadedCartState, setHasLoadedCartState] = useState(false);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

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

    restoreCartState();

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

  const totalAmount = useMemo(() => calculateTotal(cart), [cart]);
  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const focusBarcodeInput = () => {
    window.requestAnimationFrame(() => {
      barcodeInputRef.current?.focus();
    });
  };

  const showStatus = (message, tone) => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const clearCart = (message = 'Cart cleared') => {
    cartRef.current = [];
    setCart([]);
    setStockByProductId({});
    setLastScannedProductId(null);
    setLastSyncPayload(null);
    setPrintStatus('idle');
    void window.posAPI.clearCartState().catch((error) => {
      console.error('Unable to clear saved cart state:', error);
    });
    showStatus(message, 'neutral');
    focusBarcodeInput();
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

  const handleProductScanned = (product, barcode) => {
    addProductToCart(product, barcode);
  };

  const handleManualProductSelected = (product) => {
    const added = addProductToCart(product, product.name);

    if (added) {
      showStatus(`Added ${product.name} from search`, 'success');
      manualSearchRef.current?.clear();
      focusBarcodeInput();
    }
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

  const handleManualSearchMiss = (query) => {
    if (!query) {
      return;
    }

    const message = `No product found for ${query}.`;
    window.alert(message);
    showStatus(message, 'error');
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

    const matchingItem = cartRef.current.find(
      (item) => item.product_id === productId
    );

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

    if (cartRef.current.length === 0) {
      showStatus('Cart is empty. Scan items before checkout.', 'error');
      return;
    }

    setIsCheckingOut(true);
    setPrintStatus('idle');

    try {
      const result = await window.posAPI.checkout(cartRef.current);
      cartRef.current = [];
      setCart([]);
      setStockByProductId({});
      setLastReceipt(result.receipt);
      setLastSyncPayload(result.syncPayload);
      setLastScannedProductId(null);
      setLastItemLabel(result.receipt.items[0]?.name || '');
      manualSearchRef.current?.clear();
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

  useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if (isCheckingOut || isPrintingReceipt || isBackingUp) {
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        handleCheckout();
      }

      if (event.key === 'Escape') {
        event.preventDefault();

        if (cartRef.current.length > 0) {
          clearCart();
        }
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [isCheckingOut, isPrintingReceipt, isBackingUp]);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.badge}>Offline POS</div>
            <h1 style={styles.title}>Cashier billing</h1>
            <p style={styles.subtitle}>
              Fast barcode checkout with local search fallback, automatic
              recovery, cloud-ready sync, and thermal receipt printing.
            </p>
          </div>

          <aside
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
          </aside>
        </header>

        <section style={styles.inputRow}>
          <BarcodeInput
            ref={barcodeInputRef}
            onProductScanned={handleProductScanned}
            onScanMiss={handleScanMiss}
          />

          <ManualSearch
            ref={manualSearchRef}
            onProductSelected={handleManualProductSelected}
            onSearchMiss={handleManualSearchMiss}
            onReturnFocus={focusBarcodeInput}
          />
        </section>

        <section style={styles.tableRow}>
          <CartTable
            items={cart}
            lastScannedProductId={lastScannedProductId}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
          />
        </section>

        <Checkout
          totalAmount={totalAmount}
          totalItems={totalItems}
          checkoutDisabled={
            cart.length === 0 || isCheckingOut || isPrintingReceipt || isBackingUp
          }
          clearDisabled={
            cart.length === 0 || isCheckingOut || isPrintingReceipt || isBackingUp
          }
          canReprint={Boolean(lastReceipt)}
          isCheckingOut={isCheckingOut}
          isPrinting={isPrintingReceipt}
          isBackingUp={isBackingUp}
          printStatus={printStatus}
          backupStatus={backupStatus}
          onCheckout={handleCheckout}
          onClearCart={() => clearCart()}
          onReprint={handleReprint}
          onBackup={handleManualBackup}
        />
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '14px',
    backgroundColor: '#f5f7fb',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    color: '#101828',
    boxSizing: 'border-box'
  },
  shell: {
    width: '100%',
    maxWidth: '1440px',
    minHeight: 'calc(100vh - 28px)',
    margin: '0 auto',
    padding: '18px',
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr auto',
    gap: '16px',
    borderRadius: '24px',
    backgroundColor: '#edf2f8',
    boxSizing: 'border-box'
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 330px',
    gap: '16px',
    alignItems: 'stretch'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: '#dbe7ff',
    color: '#2457c5',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  title: {
    margin: '14px 0 10px',
    fontSize: '34px',
    lineHeight: 1.08
  },
  subtitle: {
    margin: 0,
    maxWidth: '720px',
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#475467'
  },
  statusPanel: {
    padding: '18px 20px',
    borderRadius: '18px',
    border: '1px solid transparent',
    boxShadow: '0 8px 22px rgba(16, 24, 40, 0.06)',
    display: 'grid',
    alignContent: 'center'
  },
  statusLabel: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0.74
  },
  statusMessage: {
    marginTop: '8px',
    fontSize: '18px',
    fontWeight: 700,
    lineHeight: 1.25
  },
  statusMeta: {
    marginTop: '8px',
    fontSize: '13px'
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
    gap: '16px',
    alignItems: 'start'
  },
  tableRow: {
    minHeight: 0
  }
};
