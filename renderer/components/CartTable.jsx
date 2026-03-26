import React, { useEffect, useState } from 'react';

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

export default function CartTable({
  items,
  lastScannedProductId,
  onQuantityChange,
  onRemove
}) {
  const [draftQuantities, setDraftQuantities] = useState({});

  useEffect(() => {
    const next = {};

    for (const item of items) {
      next[item.product_id] = String(item.quantity);
    }

    setDraftQuantities(next);
  }, [items]);

  if (items.length === 0) {
    return (
      <section style={styles.emptyState}>
        <div style={styles.emptyIcon}>Sale ready</div>
        <div style={styles.emptyTitle}>Cart is empty</div>
        <p style={styles.emptyText}>
          Scan a barcode to start building a new bill.
        </p>
      </section>
    );
  }

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

  return (
    <section style={styles.shell}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.headerCell, ...styles.nameColumn }}>Name</th>
            <th style={styles.headerCell}>Price</th>
            <th style={styles.headerCell}>Qty</th>
            <th style={styles.headerCell}>Total</th>
            <th style={{ ...styles.headerCell, ...styles.removeColumn }}>
              Remove
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isHighlighted = item.product_id === lastScannedProductId;
            const draftValue =
              draftQuantities[item.product_id] !== undefined
                ? draftQuantities[item.product_id]
                : String(item.quantity);

            return (
              <tr
                key={item.product_id}
                style={{
                  ...styles.row,
                  ...(isHighlighted ? styles.highlightedRow : {})
                }}
              >
                <td style={{ ...styles.cell, ...styles.nameCell }}>{item.name}</td>
                <td style={styles.cell}>{formatCurrency(item.price)}</td>
                <td style={styles.cell}>
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
                    style={styles.quantityInput}
                    aria-label={`Quantity for ${item.name}`}
                  />
                </td>
                <td style={{ ...styles.cell, ...styles.totalCell }}>
                  {formatCurrency(item.price * item.quantity)}
                </td>
                <td style={styles.cell}>
                  <button
                    type="button"
                    onClick={() => onRemove(item.product_id)}
                    style={styles.removeButton}
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const styles = {
  shell: {
    minHeight: '100%',
    overflow: 'auto',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.05)'
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0
  },
  headerCell: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid rgba(16, 24, 40, 0.08)',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  nameColumn: {
    width: '42%'
  },
  removeColumn: {
    width: '132px'
  },
  row: {
    transition: 'background-color 260ms ease, box-shadow 260ms ease'
  },
  highlightedRow: {
    backgroundColor: '#eef6ff',
    boxShadow: 'inset 3px 0 0 #2f6fed'
  },
  cell: {
    padding: '18px 20px',
    borderBottom: '1px solid rgba(16, 24, 40, 0.06)',
    fontSize: '15px',
    color: '#101828',
    verticalAlign: 'middle'
  },
  nameCell: {
    fontWeight: 600
  },
  totalCell: {
    fontWeight: 700
  },
  quantityInput: {
    width: '86px',
    minHeight: '42px',
    padding: '8px 10px',
    borderRadius: '12px',
    border: '1px solid rgba(16, 24, 40, 0.14)',
    backgroundColor: '#ffffff',
    fontSize: '17px',
    fontWeight: 700,
    color: '#101828',
    boxSizing: 'border-box'
  },
  removeButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid rgba(239, 68, 68, 0.14)',
    backgroundColor: '#fff5f5',
    color: '#c93636',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  emptyState: {
    minHeight: '100%',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px dashed rgba(16, 24, 40, 0.12)',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: '8px',
    padding: '32px',
    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.05)',
    boxSizing: 'border-box'
  },
  emptyIcon: {
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: '#eef4ff',
    color: '#2f6fed',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  emptyTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#101828'
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
    color: '#667085'
  }
};
