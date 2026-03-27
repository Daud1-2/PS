import React, { memo } from 'react';
import {
  getStockAlertLabel,
  getStockAlertLevel
} from '../shared/stockAlerts.js';

function formatCurrency(value) {
  return `PKR ${Number(value || 0).toFixed(2)}`;
}

function hasSellingPrice(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

const ProductCard = memo(function ProductCard({
  product,
  variant = 'pos',
  highlighted = false,
  onClick,
  onEdit,
  onDelete
}) {
  const stockLevel = getStockAlertLevel(product.stock);
  const isClickable = variant === 'pos' && typeof onClick === 'function';
  const stockCount = Number(product.stock || 0);
  const isIncomplete = !hasSellingPrice(product.sellingPrice);
  const shellStyle = {
    ...styles.row,
    ...(stockLevel === 'low'
      ? styles.lowStockRow
      : stockLevel === 'out'
        ? styles.outOfStockRow
        : {}),
    ...(highlighted ? styles.highlightedRow : {})
  };

  const handleClick = () => {
    if (isClickable) {
      onClick(product);
    }
  };

  const WrapperTag = isClickable ? 'button' : 'article';

  return (
    <WrapperTag
      type={isClickable ? 'button' : undefined}
      onClick={handleClick}
      style={{
        ...shellStyle,
        ...(isClickable ? styles.clickableCard : {})
      }}
      aria-label={isClickable ? `Add ${product.name} to cart` : product.name}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!isClickable) {
          return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(product);
        }
      }}
    >
      <div style={styles.nameBlock}>
        <div style={styles.name}>{product.name}</div>
        <div style={styles.meta}>
          {product.barcode ? `Barcode ${product.barcode}` : 'Barcode unavailable'}
        </div>
      </div>

      <div style={styles.infoStrip}>
        <div
          style={{
            ...styles.stockBadge,
            ...(stockLevel === 'low'
              ? styles.stockBadgeLow
              : stockLevel === 'out'
                ? styles.stockBadgeOut
                : styles.stockBadgeNormal)
          }}
        >
          {stockLevel === 'out'
            ? 'Out of stock'
            : stockLevel === 'low'
              ? `${stockCount} left`
              : `Stock ${stockCount}`}
        </div>

        {variant === 'manage' ? (
          <div style={styles.stockTag}>{getStockAlertLabel(product.stock)}</div>
        ) : null}
      </div>

      <div style={styles.trailingArea}>
        <div
          style={{
            ...styles.price,
            ...(isIncomplete ? styles.pricePending : {}),
            ...(stockLevel === 'low'
              ? styles.priceLow
              : stockLevel === 'out'
                ? styles.priceOut
                : {})
          }}
        >
          {isIncomplete ? 'Price pending' : formatCurrency(product.sellingPrice)}
        </div>

        {variant === 'manage' ? (
          <div style={styles.manageActions}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.(product);
              }}
              style={styles.secondaryButton}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.(product);
              }}
              style={styles.dangerButton}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </WrapperTag>
  );
});

const styles = {
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) auto auto',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 10px',
    borderBottom: '1px solid rgba(22, 48, 43, 0.08)',
    backgroundColor: 'transparent',
    boxSizing: 'border-box',
    transition: 'background-color 140ms ease, border-color 140ms ease'
  },
  lowStockRow: {
    backgroundColor: 'rgba(255, 247, 237, 0.72)'
  },
  outOfStockRow: {
    backgroundColor: 'rgba(255, 241, 242, 0.78)'
  },
  clickableCard: {
    cursor: 'pointer',
    appearance: 'none',
    textAlign: 'left',
    width: '100%',
    userSelect: 'none'
  },
  highlightedRow: {
    backgroundColor: 'rgba(51, 200, 255, 0.12)',
    borderBottomColor: 'rgba(51, 200, 255, 0.32)'
  },
  nameBlock: {
    display: 'grid',
    gap: '4px',
    minWidth: 0
  },
  name: {
    fontSize: '16px',
    fontWeight: 800,
    lineHeight: 1.28,
    color: '#17312d'
  },
  meta: {
    fontSize: '12px',
    lineHeight: 1.4,
    color: '#6f8179'
  },
  infoStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '10px',
    flexWrap: 'wrap'
  },
  stockBadge: {
    minHeight: '32px',
    padding: '0 12px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },
  stockBadgeNormal: {
    backgroundColor: '#e8f4ee',
    color: '#1c7b58'
  },
  stockBadgeLow: {
    backgroundColor: '#fff0cc',
    color: '#a16207'
  },
  stockBadgeOut: {
    backgroundColor: '#ffe4e8',
    color: '#be123c'
  },
  stockTag: {
    padding: '4px 8px',
    borderRadius: '999px',
    backgroundColor: 'rgba(22, 48, 43, 0.07)',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#5f756c',
    whiteSpace: 'nowrap'
  },
  trailingArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  price: {
    fontSize: '18px',
    fontWeight: 900,
    lineHeight: 1,
    color: '#17312d'
  },
  pricePending: {
    fontSize: '15px',
    color: '#7c8f88'
  },
  priceLow: {
    color: '#7c5a17'
  },
  priceOut: {
    color: '#9f1239'
  },
  manageActions: {
    display: 'flex',
    gap: '8px'
  },
  secondaryButton: {
    flex: 1,
    minHeight: '36px',
    borderRadius: '12px',
    border: '1px solid rgba(22, 48, 43, 0.12)',
    backgroundColor: '#eff4ff',
    color: '#2457c5',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  dangerButton: {
    flex: 1,
    minHeight: '36px',
    borderRadius: '12px',
    border: '1px solid rgba(225, 29, 72, 0.16)',
    backgroundColor: '#fff1f3',
    color: '#be123c',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
  }
};

export default ProductCard;
