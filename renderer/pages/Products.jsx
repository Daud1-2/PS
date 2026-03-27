import React, { useEffect, useMemo, useState } from 'react';
import ProductForm from '../components/ProductForm.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import { hasVeryLowStock } from '../shared/stockAlerts.js';

export default function Products({
  refreshToken,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct
}) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Product catalog ready');
  const [statusTone, setStatusTone] = useState('neutral');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsLoading(true);

      try {
        const nextProducts = await window.posAPI.listProducts('');

        if (!isMounted) {
          return;
        }

        setProducts(
          [...nextProducts].sort((left, right) =>
            String(left.name || '').localeCompare(String(right.name || ''))
          )
        );
      } catch (error) {
        console.error('Unable to load products:', error);

        if (!isMounted) {
          return;
        }

        setProducts([]);
        setStatusMessage(error?.message || 'Unable to load product catalog');
        setStatusTone('error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [refreshToken]);

  const totalStock = useMemo(() => {
    return products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((product) => hasVeryLowStock(product.stock)).length;
  }, [products]);

  const handleCreate = async (payload) => {
    const product = await onAddProduct?.(payload);
    setIsCreateOpen(false);
    setStatusMessage(`Added ${product.name} successfully`);
    setStatusTone('success');
  };

  const handleUpdate = async (payload) => {
    const product = await onUpdateProduct?.(editingProduct.id, payload);
    setEditingProduct(null);
    setStatusMessage(`Updated ${product.name} successfully`);
    setStatusTone('success');
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(
      `Delete ${product.name}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const deletedProduct = await onDeleteProduct?.(product.id);
    setEditingProduct((current) => (current?.id === product.id ? null : current));
    setStatusMessage(`Deleted ${deletedProduct.name} successfully`);
    setStatusTone('success');
  };

  return (
    <>
      <section style={styles.page}>
        <header style={styles.header}>
          <div style={styles.headerCopy}>
            <div style={styles.badge}>Products</div>
            <h2 style={styles.title}>Catalog list layout</h2>
            <p style={styles.subtitle}>
              Search, scan through, and manage the offline catalog with the same
              fast scrollable list used in the POS quick-select flow.
            </p>
          </div>

          <div
            style={{
              ...styles.statusPill,
              ...(statusTone === 'success' ? styles.statusSuccess : {}),
              ...(statusTone === 'error' ? styles.statusError : {})
            }}
          >
            {statusMessage}
          </div>
        </header>

        <section style={styles.toolbar}>
          <div style={styles.metricRow}>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Products</span>
              <strong style={styles.metricValue}>{products.length}</strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Stock units</span>
              <strong style={styles.metricValue}>{totalStock}</strong>
            </div>
            <div
              style={{
                ...styles.metricCard,
                ...(lowStockCount > 0 ? styles.metricAlertCard : {})
              }}
            >
              <span style={styles.metricLabel}>Low stock</span>
              <strong style={styles.metricValue}>{lowStockCount}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            style={styles.primaryButton}
          >
            Add Product
          </button>
        </section>

        {lowStockCount > 0 ? (
          <section style={styles.lowStockBanner}>
            <div style={styles.lowStockBannerEyebrow}>Reorder soon</div>
            <div style={styles.lowStockBannerTitle}>
              {lowStockCount} product{lowStockCount === 1 ? '' : 's'} need stock
              attention.
            </div>
            <div style={styles.lowStockBannerText}>
              Low inventory rows are highlighted so the next reorder list is easy
              to spot.
            </div>
          </section>
        ) : null}

        <section style={styles.gridPanel}>
          <ProductGrid
            products={products}
            isLoading={isLoading}
            variant="manage"
            title="Catalog List"
            subtitle="Real-time local filtering with edit and delete actions."
            searchLabel="Search Catalog"
            searchPlaceholder="Search by name, barcode, or stock"
            onEditProduct={(product) => setEditingProduct(product)}
            onDeleteProduct={(product) => {
              void handleDelete(product);
            }}
          />
        </section>
      </section>

      <ProductForm
        isOpen={isCreateOpen}
        mode="create"
        title="Add new product"
        submitLabel="Save product"
        initialValues={{
          stock: 1
        }}
        onSubmit={handleCreate}
        onClose={() => setIsCreateOpen(false)}
      />

      <ProductForm
        isOpen={Boolean(editingProduct)}
        mode="edit"
        title="Edit product"
        submitLabel="Save changes"
        initialValues={editingProduct || undefined}
        onSubmit={handleUpdate}
        onClose={() => setEditingProduct(null)}
      />
    </>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: '20px',
    minHeight: '100%',
    padding: '28px 28px 32px',
    boxSizing: 'border-box'
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'start',
    gap: '20px',
    padding: '28px 30px',
    borderRadius: '28px',
    background: 'rgba(255, 255, 255, 0.78)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.06)'
  },
  headerCopy: {
    display: 'grid',
    gap: '10px'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: '#e5eefc',
    color: '#2457c5',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  title: {
    margin: 0,
    fontSize: '34px',
    lineHeight: 1.08,
    color: '#101828'
  },
  subtitle: {
    margin: 0,
    maxWidth: '720px',
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#475467'
  },
  statusPill: {
    maxWidth: '540px',
    padding: '14px 18px',
    borderRadius: '18px',
    backgroundColor: '#f8fafc',
    color: '#667085',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    lineHeight: 1.45,
    textTransform: 'uppercase'
  },
  statusSuccess: {
    backgroundColor: '#ecfdf3',
    color: '#166534',
    borderColor: 'rgba(34, 197, 94, 0.16)'
  },
  statusError: {
    backgroundColor: '#fef2f2',
    color: '#b42318',
    borderColor: 'rgba(239, 68, 68, 0.14)'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  },
  metricRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  metricCard: {
    minWidth: '132px',
    padding: '14px 16px',
    borderRadius: '18px',
    background: 'rgba(255, 255, 255, 0.76)',
    border: '1px solid rgba(148, 163, 184, 0.12)',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)'
  },
  metricAlertCard: {
    background: 'linear-gradient(180deg, #fff7ed 0%, #ffe7d1 100%)',
    border: '1px solid rgba(249, 115, 22, 0.16)'
  },
  metricLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  metricValue: {
    display: 'block',
    marginTop: '8px',
    fontSize: '26px',
    lineHeight: 1,
    color: '#101828'
  },
  primaryButton: {
    minHeight: '52px',
    padding: '0 24px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #17312d 0%, #245248 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(22, 48, 43, 0.18)'
  },
  lowStockBanner: {
    padding: '18px 20px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffe4e6 100%)',
    border: '1px solid rgba(249, 115, 22, 0.18)',
    boxShadow: '0 12px 24px rgba(249, 115, 22, 0.1)'
  },
  lowStockBannerEyebrow: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#c2410c'
  },
  lowStockBannerTitle: {
    marginTop: '8px',
    fontSize: '20px',
    fontWeight: 800,
    color: '#7c2d12'
  },
  lowStockBannerText: {
    marginTop: '6px',
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#9a3412'
  },
  gridPanel: {
    padding: '22px',
    borderRadius: '28px',
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)'
  }
};
