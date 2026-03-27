import React, { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { hasVeryLowStock } from '../shared/stockAlerts.js';
import ProductCard from './ProductCard.jsx';

const INITIAL_VISIBLE_BY_VARIANT = {
  pos: 120,
  manage: 180
};

const LOAD_MORE_STEP_BY_VARIANT = {
  pos: 120,
  manage: 180
};

const ProductGrid = memo(function ProductGrid({
  products,
  isLoading = false,
  variant = 'pos',
  title,
  subtitle,
  searchLabel = 'Search Products',
  searchPlaceholder = 'Search by name or barcode',
  highlightedProductId = null,
  onProductClick,
  onEditProduct,
  onDeleteProduct,
  actionSlot = null
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const initialVisibleCount =
    INITIAL_VISIBLE_BY_VARIANT[variant] || INITIAL_VISIBLE_BY_VARIANT.pos;
  const loadMoreStep =
    LOAD_MORE_STEP_BY_VARIANT[variant] || LOAD_MORE_STEP_BY_VARIANT.pos;
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  useEffect(() => {
    setVisibleCount(initialVisibleCount);
  }, [deferredQuery, initialVisibleCount, products.length]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

      return products.filter((product) => {
        const haystacks = [
          product.name,
          product.barcode,
          String(product.stock),
          product.sellingPrice === null || product.sellingPrice === undefined
            ? ''
            : String(product.sellingPrice)
        ];

      return haystacks.some((value) =>
        String(value || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [products, deferredQuery]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const lowStockCount = useMemo(() => {
    return products.filter((product) => hasVeryLowStock(product.stock)).length;
  }, [products]);

  return (
    <section style={styles.shell}>
      <div style={styles.header}>
        <div style={styles.headerCopy}>
          <div style={styles.title}>{title}</div>
          {subtitle ? <div style={styles.subtitle}>{subtitle}</div> : null}
        </div>

        <div style={styles.headerAside}>
          <div style={styles.metricChipPrimary}>All {products.length}</div>
          <div style={styles.metricChip}>Low Stock {lowStockCount}</div>
          <div style={styles.metricChipMuted}>
            Showing {Math.min(visibleProducts.length, filteredProducts.length)} of{' '}
            {filteredProducts.length}
          </div>
          {actionSlot}
        </div>
      </div>

      <label style={styles.searchShell}>
        <div style={styles.searchIcon}>S</div>
        <div style={styles.searchInputWrap}>
          <div style={styles.searchLabel}>{searchLabel}</div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            style={styles.searchInput}
          />
        </div>
      </label>

      {isLoading ? (
        <div style={styles.stateCard}>Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div style={styles.stateCard}>
          {query.trim()
            ? 'No products matched the current search.'
            : 'No products are available yet.'}
        </div>
      ) : (
        <>
          <div style={styles.listShell}>
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant={variant}
                highlighted={highlightedProductId === product.id}
                onClick={onProductClick}
                onEdit={onEditProduct}
                onDelete={onDeleteProduct}
              />
            ))}
          </div>

          {visibleProducts.length < filteredProducts.length ? (
            <div style={styles.loadMoreWrap}>
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((current) =>
                    Math.min(current + loadMoreStep, filteredProducts.length)
                  )
                }
                style={styles.loadMoreButton}
              >
                Load {Math.min(loadMoreStep, filteredProducts.length - visibleProducts.length)}{' '}
                more
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
});

const styles = {
  shell: {
    display: 'grid',
    gap: '14px',
    minHeight: 0
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap'
  },
  headerCopy: {
    display: 'grid',
    gap: '4px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#17312d'
  },
  subtitle: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#667d75'
  },
  headerAside: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  metricChipPrimary: {
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#17312d',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800
  },
  metricChip: {
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#edf4f0',
    color: '#48665d',
    fontSize: '12px',
    fontWeight: 800
  },
  metricChipMuted: {
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#f5f7f6',
    color: '#6e837c',
    fontSize: '12px',
    fontWeight: 700
  },
  searchShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 14px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.76)',
    border: '1px solid rgba(22, 48, 43, 0.08)',
    boxShadow: '0 14px 30px rgba(92, 74, 28, 0.06)'
  },
  searchIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17312d',
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 800,
    flexShrink: 0
  },
  searchInputWrap: {
    display: 'grid',
    gap: '4px',
    flex: 1
  },
  searchLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#7b8e87'
  },
  searchInput: {
    width: '100%',
    minHeight: '26px',
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    fontSize: '16px',
    fontWeight: 600,
    color: '#233834',
    boxSizing: 'border-box'
  },
  stateCard: {
    padding: '28px',
    borderRadius: '18px',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    border: '1px dashed rgba(22, 48, 43, 0.16)',
    textAlign: 'center',
    fontSize: '14px',
    color: '#667d75'
  },
  listShell: {
    display: 'grid',
    gap: 0,
    borderRadius: '22px',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    border: '1px solid rgba(22, 48, 43, 0.08)',
    overflow: 'hidden'
  },
  loadMoreWrap: {
    display: 'flex',
    justifyContent: 'center'
  },
  loadMoreButton: {
    minHeight: '46px',
    padding: '0 18px',
    borderRadius: '14px',
    border: '1px solid rgba(22, 48, 43, 0.12)',
    backgroundColor: '#ffffff',
    color: '#17312d',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(22, 48, 43, 0.06)'
  }
};

export default ProductGrid;
