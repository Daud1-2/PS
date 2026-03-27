import React, { useEffect, useState } from 'react';

function formatCurrency(value) {
  return `PKR ${Number(value || 0).toFixed(2)}`;
}

export default function CartTable({
  items,
  lastScannedProductId,
  onQuantityChange,
  onRemove,
  tone = 'light'
}) {
  const [draftQuantities, setDraftQuantities] = useState({});
  const isDark = tone === 'dark';

  useEffect(() => {
    const next = {};

    for (const item of items) {
      next[item.product_id] = String(item.quantity);
    }

    setDraftQuantities(next);
  }, [items]);

  const commitQuantity = (productId, fallbackQuantity) => {
    const rawValue = String(
      draftQuantities[productId] !== undefined
        ? draftQuantities[productId]
        : fallbackQuantity
    ).trim();

    if (!rawValue) {
      setDraftQuantities((current) => ({
        ...current,
        [productId]: String(fallbackQuantity)
      }));
      return;
    }

    const parsedQuantity = Number.parseInt(rawValue, 10);

    if (!Number.isInteger(parsedQuantity)) {
      setDraftQuantities((current) => ({
        ...current,
        [productId]: String(fallbackQuantity)
      }));
      return;
    }

    onQuantityChange(productId, parsedQuantity);
  };

  const stepQuantity = (productId, nextQuantity) => {
    onQuantityChange(productId, nextQuantity);
  };

  if (items.length === 0) {
    return (
      <section
        style={{
          ...styles.emptyState,
          ...(isDark ? styles.emptyStateDark : {})
        }}
      >
        <div style={{ ...styles.emptyEyebrow, ...(isDark ? styles.emptyEyebrowDark : {}) }}>
          Sale ready
        </div>
        <div style={{ ...styles.emptyTitle, ...(isDark ? styles.emptyTitleDark : {}) }}>
          Cart is empty
        </div>
        <p style={{ ...styles.emptyText, ...(isDark ? styles.emptyTextDark : {}) }}>
          Scan a barcode or tap a product card to start building a bill.
        </p>
      </section>
    );
  }

  return (
    <section style={{ ...styles.shell, ...(isDark ? styles.shellDark : {}) }}>
      <div style={styles.list}>
        {items.map((item) => {
          const isHighlighted = item.product_id === lastScannedProductId;
          const draftValue =
            draftQuantities[item.product_id] !== undefined
              ? draftQuantities[item.product_id]
              : String(item.quantity);

          return (
            <article
              key={item.product_id}
              style={{
                ...styles.itemCard,
                ...(isDark ? styles.itemCardDark : {}),
                ...(isHighlighted ? styles.itemCardHighlighted : {})
              }}
            >
              <div style={styles.itemHeader}>
                <div style={styles.itemCopy}>
                  <div
                    style={{
                      ...styles.itemName,
                      ...(isDark ? styles.itemNameDark : {})
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      ...styles.itemMeta,
                      ...(isDark ? styles.itemMetaDark : {})
                    }}
                  >
                    {formatCurrency(item.price)} each
                  </div>
                </div>

                <div
                  style={{
                    ...styles.itemTotal,
                    ...(isDark ? styles.itemTotalDark : {})
                  }}
                >
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>

              <div style={styles.itemFooter}>
                <div style={styles.quantityWrap}>
                  <span
                    style={{
                      ...styles.quantityLabel,
                      ...(isDark ? styles.quantityLabelDark : {})
                    }}
                  >
                    Qty
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      stepQuantity(item.product_id, item.quantity - 1);
                    }}
                    style={{
                      ...styles.stepButton,
                      ...(isDark ? styles.stepButtonDark : {})
                    }}
                    aria-label={`Decrease quantity for ${item.name}`}
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftValue}
                    onChange={(event) => {
                      const digitsOnly = event.target.value.replace(/\D+/g, '');

                      setDraftQuantities((current) => ({
                        ...current,
                        [item.product_id]: digitsOnly
                      }));
                    }}
                    onFocus={(event) => {
                      event.target.select();
                    }}
                    onClick={(event) => {
                      event.currentTarget.select();
                    }}
                    onBlur={() => {
                      commitQuantity(item.product_id, item.quantity);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitQuantity(item.product_id, item.quantity);
                        event.currentTarget.blur();
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setDraftQuantities((current) => ({
                          ...current,
                          [item.product_id]: String(item.quantity)
                        }));
                        event.currentTarget.blur();
                      }
                    }}
                    style={{
                      ...styles.quantityInput,
                      ...(isDark ? styles.quantityInputDark : {})
                    }}
                    aria-label={`Quantity for ${item.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      stepQuantity(item.product_id, item.quantity + 1);
                    }}
                    style={{
                      ...styles.stepButton,
                      ...(isDark ? styles.stepButtonDark : {})
                    }}
                    aria-label={`Increase quantity for ${item.name}`}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.product_id)}
                  style={{
                    ...styles.removeButton,
                    ...(isDark ? styles.removeButtonDark : {})
                  }}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  shell: {
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  shellDark: {
    flex: 1
  },
  list: {
    display: 'grid',
    gap: '10px'
  },
  itemCard: {
    display: 'grid',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 10px 24px rgba(16, 24, 40, 0.06)'
  },
  itemCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: 'none'
  },
  itemCardHighlighted: {
    boxShadow: '0 0 0 2px rgba(51, 200, 255, 0.22)'
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px'
  },
  itemCopy: {
    display: 'grid',
    gap: '6px'
  },
  itemName: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#101828'
  },
  itemNameDark: {
    color: '#ffffff'
  },
  itemMeta: {
    fontSize: '13px',
    color: '#667085'
  },
  itemMetaDark: {
    color: '#a6bbb1'
  },
  itemTotal: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#101828',
    whiteSpace: 'nowrap'
  },
  itemTotalDark: {
    color: '#ffffff'
  },
  itemFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap'
  },
  quantityWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  quantityLabel: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  quantityLabelDark: {
    color: '#8fb2a5'
  },
  quantityInput: {
    width: '72px',
    minHeight: '38px',
    padding: '8px 10px',
    borderRadius: '12px',
    border: '1px solid rgba(16, 24, 40, 0.12)',
    backgroundColor: '#f8fafc',
    fontSize: '15px',
    fontWeight: 800,
    color: '#101828',
    boxSizing: 'border-box'
  },
  quantityInputDark: {
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#ffffff'
  },
  stepButton: {
    width: '34px',
    minWidth: '34px',
    minHeight: '34px',
    borderRadius: '10px',
    border: '1px solid rgba(16, 24, 40, 0.12)',
    backgroundColor: '#f8fafc',
    color: '#101828',
    fontSize: '18px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  stepButtonDark: {
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#ffffff'
  },
  removeButton: {
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid rgba(225, 29, 72, 0.14)',
    backgroundColor: '#fff1f3',
    color: '#be123c',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0
  },
  removeButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#f5f1e8'
  },
  emptyState: {
    minHeight: '220px',
    borderRadius: '22px',
    backgroundColor: '#ffffff',
    border: '1px dashed rgba(16, 24, 40, 0.12)',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '8px',
    padding: '32px',
    boxSizing: 'border-box'
  },
  emptyStateDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px dashed rgba(255, 255, 255, 0.12)'
  },
  emptyEyebrow: {
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: '#eef4ff',
    color: '#2457c5',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  emptyEyebrowDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#a6bbb1'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#101828'
  },
  emptyTitleDark: {
    color: '#ffffff'
  },
  emptyText: {
    margin: 0,
    fontSize: '12px',
    color: '#667085',
    textAlign: 'center'
  },
  emptyTextDark: {
    color: '#a6bbb1'
  }
};
