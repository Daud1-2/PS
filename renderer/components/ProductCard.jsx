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
    ...styles.card,
    ...(variant === 'manage' ? styles.manageCard : styles.posCard),
    ...(stockLevel === 'low'
      ? styles.lowStockCard
      : stockLevel === 'out'
        ? styles.outOfStockCard
        : {}),
    ...(highlighted ? styles.highlightedCard : {})
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
      <div style={styles.topRow}>
        <div style={styles.nameBlock}>
          <div style={styles.name}>{product.name}</div>
          <div style={styles.meta}>
            {product.barcode ? `Barcode ${product.barcode}` : 'Barcode unavailable'}
          </div>
        </div>

        <div
          style={{
            ...styles.cornerBadge,
            ...(stockLevel === 'low'
              ? styles.cornerBadgeLow
              : stockLevel === 'out'
                ? styles.cornerBadgeOut
                : styles.cornerBadgeNormal)
          }}
        >
          {stockLevel === 'normal' ? '+' : '!'}
        </div>
      </div>

      <div style={styles.middleRow}>
        <div
          style={{
            ...styles.stockText,
            ...(stockLevel === 'low'
              ? styles.stockTextLow
              : stockLevel === 'out'
                ? styles.stockTextOut
                : {})
          }}
        >
          {stockLevel === 'out'
            ? 'Out of stock'
            : stockLevel === 'low'
              ? `Low stock: ${stockCount} left`
              : `Stock ${stockCount}`}
        </div>

        {variant === 'manage' ? (
          <div style={styles.stockTag}>{getStockAlertLabel(product.stock)}</div>
        ) : null}
      </div>

      <div style={styles.bottomRow}>
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
  card: {
    minHeight: '148px',
    padding: '12px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    border: '1px solid rgba(22, 48, 43, 0.08)',
    boxSizing: 'border-box',
    transition:
      'background-color 140ms ease, box-shadow 140ms ease, border-color 140ms ease'
  },
  posCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f2f6f3 100%)',
    boxShadow: '0 10px 22px rgba(22, 48, 43, 0.06)'
  },
  manageCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f7f8fb 100%)',
    boxShadow: '0 12px 26px rgba(15, 23, 42, 0.06)'
  },
  lowStockCard: {
    background: 'linear-gradient(180deg, #fffaf0 0%, #f9efd7 100%)',
    borderColor: 'rgba(202, 138, 4, 0.18)'
  },
  outOfStockCard: {
    background: 'linear-gradient(180deg, #fff5f7 0%, #ffe8ed 100%)',
    borderColor: 'rgba(225, 29, 72, 0.18)'
  },
  clickableCard: {
    cursor: 'pointer',
    appearance: 'none',
    textAlign: 'left',
    width: '100%',
    userSelect: 'none'
  },
  highlightedCard: {
    borderColor: 'rgba(51, 200, 255, 0.5)',
    boxShadow: '0 0 0 2px rgba(51, 200, 255, 0.18), 0 18px 28px rgba(22, 48, 43, 0.14)'
  },
  topRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px'
  },
  nameBlock: {
    display: 'grid',
    gap: '6px',
    minWidth: 0
  },
  name: {
    fontSize: '14px',
    fontWeight: 800,
    lineHeight: 1.3,
    color: '#17312d'
  },
  meta: {
    fontSize: '11px',
    lineHeight: 1.4,
    color: '#6f8179'
  },
  cornerBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '12px',
    fontWeight: 900
  },
  cornerBadgeNormal: {
    backgroundColor: '#e8f4ee',
    color: '#1c7b58'
  },
  cornerBadgeLow: {
    backgroundColor: '#fff0cc',
    color: '#a16207'
  },
  cornerBadgeOut: {
    backgroundColor: '#ffe4e8',
    color: '#be123c'
  },
  middleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    minHeight: '30px'
  },
  stockText: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#5f756c'
  },
  stockTextLow: {
    color: '#a16207'
  },
  stockTextOut: {
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
  bottomRow: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  price: {
    fontSize: '24px',
    fontWeight: 900,
    lineHeight: 1,
    color: '#17312d'
  },
  pricePending: {
    fontSize: '18px',
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
