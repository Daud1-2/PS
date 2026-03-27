import React, { useEffect, useMemo, useState } from 'react';
import {
  getStockAlertLabel,
  getStockAlertLevel,
  hasVeryLowStock
} from '../shared/stockAlerts.js';

const adminConfig = window.__ADMIN_CONFIG__ || {};

function createApiUrl(pathname) {
  const baseUrl = String(adminConfig.apiBaseUrl || '').trim();

  if (!baseUrl) {
    return pathname;
  }

  return `${baseUrl}${pathname}`;
}

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString();
}

function createDraft(product) {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    costPrice: String(product.costPrice),
    sellingPrice: String(product.sellingPrice),
    stock: String(product.stock)
  };
}

export default function ProductManager({
  apiKey,
  products,
  serverTime,
  onRefreshRequested,
  isCompact = false,
  isMobile = false
}) {
  const [createForm, setCreateForm] = useState({
    name: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    stock: ''
  });
  const [drafts, setDrafts] = useState({});
  const [statusMessage, setStatusMessage] = useState('Manage products from the dashboard');
  const [statusTone, setStatusTone] = useState('neutral');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const nextDrafts = {};

    for (const product of products) {
      nextDrafts[product.id] = createDraft(product);
    }

    setDrafts(nextDrafts);
  }, [products]);

  const visibleProducts = useMemo(() => {
    return [...products].sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: 'base'
      })
    );
  }, [products]);

  const lowStockCount = useMemo(() => {
    return visibleProducts.filter((product) =>
      hasVeryLowStock(drafts[product.id]?.stock ?? product.stock)
    ).length;
  }, [drafts, visibleProducts]);

  async function requestJson(pathname, options = {}) {
    const response = await fetch(createApiUrl(pathname), {
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  function updateCreateField(field, value) {
    setCreateForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateDraft(productId, field, value) {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: value
      }
    }));
  }

  function normalizePayload(source) {
    const payload = {
      name: String(source.name || '').trim(),
      barcode: String(source.barcode || '').trim(),
      costPrice: Number(source.costPrice),
      sellingPrice: Number(source.sellingPrice),
      stock: Number(source.stock)
    };

    if (!payload.name) {
      throw new Error('Product name is required.');
    }

    if (!payload.barcode) {
      throw new Error('Barcode is required.');
    }

    if (!Number.isFinite(payload.costPrice)) {
      throw new Error('Cost price must be a number.');
    }

    if (!Number.isFinite(payload.sellingPrice)) {
      throw new Error('Selling price must be a number.');
    }

    if (!Number.isInteger(payload.stock) || payload.stock < 0) {
      throw new Error('Stock must be a whole number.');
    }

    return payload;
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!apiKey || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = normalizePayload(createForm);
      await requestJson('/products', {
        method: 'POST',
        body: payload
      });
      setCreateForm({
        name: '',
        barcode: '',
        costPrice: '',
        sellingPrice: '',
        stock: ''
      });
      setStatusMessage('Product added successfully');
      setStatusTone('success');
      await onRefreshRequested?.();
    } catch (error) {
      console.error('Product create failed:', error);
      setStatusMessage(error.message || 'Unable to create product');
      setStatusTone('error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(productId) {
    if (!apiKey || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = normalizePayload(drafts[productId] || {});
      await requestJson(`/products/${productId}`, {
        method: 'PUT',
        body: payload
      });
      setStatusMessage(`Saved product #${productId}`);
      setStatusTone('success');
      await onRefreshRequested?.();
    } catch (error) {
      console.error('Product update failed:', error);
      setStatusMessage(error.message || 'Unable to save product');
      setStatusTone('error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(productId) {
    if (!apiKey || isSaving) {
      return;
    }

    const draft = drafts[productId];
    const productName = String(draft?.name || '').trim() || `product #${productId}`;
    const confirmed = window.confirm(`Delete ${productName}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    try {
      await requestJson(`/products/${productId}`, {
        method: 'DELETE'
      });
      setStatusMessage(`Deleted ${productName}`);
      setStatusTone('success');
      await onRefreshRequested?.();
    } catch (error) {
      console.error('Product delete failed:', error);
      setStatusMessage(error.message || 'Unable to delete product');
      setStatusTone('error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section style={styles.panel}>
      <header
        style={{
          ...styles.header,
          ...(isCompact ? styles.headerStack : {})
        }}
      >
        <div>
          <div style={styles.title}>Product manager</div>
          <div style={styles.meta}>
            Server snapshot: {formatDateTime(serverTime)}
          </div>
        </div>
        <div
          style={{
            ...styles.statusBadge,
            ...(statusTone === 'success' ? styles.statusSuccess : {}),
            ...(statusTone === 'error' ? styles.statusError : {})
          }}
        >
          {statusMessage}
        </div>
      </header>

      <form
        style={{
          ...styles.createGrid,
          ...(isCompact ? styles.createGridCompact : {}),
          ...(isMobile ? styles.createGridMobile : {})
        }}
        onSubmit={handleCreate}
      >
        <input
          type="text"
          value={createForm.name}
          onChange={(event) => updateCreateField('name', event.target.value)}
          placeholder="Product name"
          style={{ ...styles.input, ...(isCompact ? styles.inputCompact : {}) }}
        />
        <input
          type="text"
          value={createForm.barcode}
          onChange={(event) => updateCreateField('barcode', event.target.value)}
          placeholder="Barcode"
          style={{ ...styles.input, ...(isCompact ? styles.inputCompact : {}) }}
        />
        <input
          type="number"
          step="0.01"
          value={createForm.costPrice}
          onChange={(event) => updateCreateField('costPrice', event.target.value)}
          placeholder="Cost price"
          style={{ ...styles.input, ...(isCompact ? styles.inputCompact : {}) }}
        />
        <input
          type="number"
          step="0.01"
          value={createForm.sellingPrice}
          onChange={(event) =>
            updateCreateField('sellingPrice', event.target.value)
          }
          placeholder="Selling price"
          style={{ ...styles.input, ...(isCompact ? styles.inputCompact : {}) }}
        />
        <input
          type="number"
          step="1"
          value={createForm.stock}
          onChange={(event) => updateCreateField('stock', event.target.value)}
          placeholder="Stock"
          style={{ ...styles.input, ...(isCompact ? styles.inputCompact : {}) }}
        />
        <button
          type="submit"
          style={{
            ...styles.primaryButton,
            ...(isCompact ? styles.primaryButtonCompact : {})
          }}
          disabled={!apiKey || isSaving}
        >
          {isSaving ? 'Saving...' : 'Add product'}
        </button>
      </form>

      {lowStockCount > 0 ? (
        <section style={styles.lowStockBanner}>
          <div style={styles.lowStockBannerLabel}>Inventory alert</div>
          <div style={styles.lowStockBannerTitle}>
            {lowStockCount} product{lowStockCount === 1 ? '' : 's'}{' '}
            {lowStockCount === 1 ? 'needs' : 'need'} restocking soon.
          </div>
          <div style={styles.lowStockBannerText}>
            Rows marked below are very low or already out of stock.
          </div>
        </section>
      ) : null}

      {isCompact ? (
        <div style={styles.mobileCardList}>
          {visibleProducts.map((product) => {
            const draft = drafts[product.id] || createDraft(product);
            const stockAlertLevel = getStockAlertLevel(draft.stock);

            return (
              <article
                key={product.id}
                style={{
                  ...styles.mobileCard,
                  ...(stockAlertLevel === 'out'
                    ? styles.outOfStockRow
                    : stockAlertLevel === 'low'
                      ? styles.lowStockRow
                      : {})
                }}
              >
                <div style={styles.mobileCardHeader}>
                  <div style={styles.mobileCardTitle}>Product #{product.id}</div>
                  {stockAlertLevel !== 'normal' ? (
                    <span
                      style={{
                        ...styles.stockTag,
                        ...(stockAlertLevel === 'out'
                          ? styles.stockTagOut
                          : styles.stockTagLow)
                      }}
                    >
                      {getStockAlertLabel(draft.stock)}
                    </span>
                  ) : null}
                </div>

                <div style={styles.mobileFieldGrid}>
                  <label style={styles.mobileField}>
                    <span style={styles.mobileLabel}>Name</span>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) =>
                        updateDraft(product.id, 'name', event.target.value)
                      }
                      style={styles.tableInput}
                    />
                  </label>
                  <label style={styles.mobileField}>
                    <span style={styles.mobileLabel}>Barcode</span>
                    <input
                      type="text"
                      value={draft.barcode}
                      onChange={(event) =>
                        updateDraft(product.id, 'barcode', event.target.value)
                      }
                      style={styles.tableInput}
                    />
                  </label>
                  <label style={styles.mobileField}>
                    <span style={styles.mobileLabel}>Cost</span>
                    <input
                      type="number"
                      step="0.01"
                      value={draft.costPrice}
                      onChange={(event) =>
                        updateDraft(product.id, 'costPrice', event.target.value)
                      }
                      style={styles.tableInput}
                    />
                  </label>
                  <label style={styles.mobileField}>
                    <span style={styles.mobileLabel}>Sell</span>
                    <input
                      type="number"
                      step="0.01"
                      value={draft.sellingPrice}
                      onChange={(event) =>
                        updateDraft(product.id, 'sellingPrice', event.target.value)
                      }
                      style={styles.tableInput}
                    />
                  </label>
                  <label style={styles.mobileField}>
                    <span style={styles.mobileLabel}>Stock</span>
                    <input
                      type="number"
                      step="1"
                      value={draft.stock}
                      onChange={(event) =>
                        updateDraft(product.id, 'stock', event.target.value)
                      }
                      style={{
                        ...styles.tableInput,
                        ...(stockAlertLevel === 'out'
                          ? styles.tableInputOut
                          : stockAlertLevel === 'low'
                            ? styles.tableInputLow
                            : {})
                      }}
                    />
                  </label>
                </div>

                {stockAlertLevel !== 'normal' ? (
                  <div style={styles.stockHelpText}>Reorder before it runs out.</div>
                ) : null}

                <div
                  style={{
                    ...styles.actionsCell,
                    ...(isMobile ? styles.actionsCellStack : {})
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...styles.secondaryButton,
                      ...(isMobile ? styles.fullWidthButton : {})
                    }}
                    onClick={() => handleSave(product.id)}
                    disabled={!apiKey || isSaving}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.dangerButton,
                      ...(isMobile ? styles.fullWidthButton : {})
                    }}
                    onClick={() => handleDelete(product.id)}
                    disabled={!apiKey || isSaving}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.headerCell}>Name</th>
                <th style={styles.headerCell}>Barcode</th>
                <th style={styles.headerCell}>Cost</th>
                <th style={styles.headerCell}>Sell</th>
                <th style={styles.headerCell}>Stock</th>
                <th style={styles.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const draft = drafts[product.id] || createDraft(product);
                const stockAlertLevel = getStockAlertLevel(draft.stock);

                return (
                  <tr
                    key={product.id}
                    style={
                      stockAlertLevel === 'out'
                        ? styles.outOfStockRow
                        : stockAlertLevel === 'low'
                          ? styles.lowStockRow
                          : undefined
                    }
                  >
                    <td style={styles.cell}>
                      <div style={styles.nameCell}>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(event) =>
                            updateDraft(product.id, 'name', event.target.value)
                          }
                          style={styles.tableInput}
                        />
                        {stockAlertLevel !== 'normal' ? (
                          <span
                            style={{
                              ...styles.stockTag,
                              ...(stockAlertLevel === 'out'
                                ? styles.stockTagOut
                                : styles.stockTagLow)
                            }}
                          >
                            {getStockAlertLabel(draft.stock)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={styles.cell}>
                      <input
                        type="text"
                        value={draft.barcode}
                        onChange={(event) =>
                          updateDraft(product.id, 'barcode', event.target.value)
                        }
                        style={styles.tableInput}
                      />
                    </td>
                    <td style={styles.cell}>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.costPrice}
                        onChange={(event) =>
                          updateDraft(product.id, 'costPrice', event.target.value)
                        }
                        style={styles.tableInput}
                      />
                    </td>
                    <td style={styles.cell}>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.sellingPrice}
                        onChange={(event) =>
                          updateDraft(product.id, 'sellingPrice', event.target.value)
                        }
                        style={styles.tableInput}
                      />
                    </td>
                    <td style={styles.cell}>
                      <div style={styles.stockEditor}>
                        <input
                          type="number"
                          step="1"
                          value={draft.stock}
                          onChange={(event) =>
                            updateDraft(product.id, 'stock', event.target.value)
                          }
                          style={{
                            ...styles.tableInput,
                            ...(stockAlertLevel === 'out'
                              ? styles.tableInputOut
                              : stockAlertLevel === 'low'
                                ? styles.tableInputLow
                                : {})
                          }}
                        />
                        {stockAlertLevel !== 'normal' ? (
                          <span style={styles.stockHelpText}>
                            Reorder before it runs out.
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={styles.cell}>
                      <div style={styles.actionsCell}>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() => handleSave(product.id)}
                          disabled={!apiKey || isSaving}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          style={styles.dangerButton}
                          onClick={() => handleDelete(product.id)}
                          disabled={!apiKey || isSaving}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const styles = {
  panel: {
    padding: '18px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px'
  },
  headerStack: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  title: {
    fontSize: '16px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#475467'
  },
  meta: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#667085'
  },
  statusBadge: {
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#f8fafc',
    color: '#667085',
    fontSize: '12px',
    fontWeight: 700
  },
  statusSuccess: {
    backgroundColor: '#ecfdf3',
    color: '#166534'
  },
  statusError: {
    backgroundColor: '#fef2f2',
    color: '#b42318'
  },
  createGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '18px'
  },
  createGridCompact: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
  },
  createGridMobile: {
    gridTemplateColumns: '1fr'
  },
  lowStockBanner: {
    marginTop: '18px',
    padding: '16px 18px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffe4e6 100%)',
    border: '1px solid rgba(249, 115, 22, 0.18)'
  },
  lowStockBannerLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#c2410c'
  },
  lowStockBannerTitle: {
    marginTop: '6px',
    fontSize: '18px',
    fontWeight: 800,
    color: '#7c2d12'
  },
  lowStockBannerText: {
    marginTop: '4px',
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#9a3412'
  },
  input: {
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#111827',
    boxSizing: 'border-box'
  },
  inputCompact: {
    width: '100%',
    minWidth: 0
  },
  primaryButton: {
    minHeight: '44px',
    border: 'none',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #2457c5 0%, #2f6fed 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  primaryButtonCompact: {
    width: '100%'
  },
  secondaryButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid rgba(36, 87, 197, 0.18)',
    backgroundColor: '#eef6ff',
    color: '#2457c5',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  dangerButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '10px',
    border: '1px solid rgba(239, 68, 68, 0.18)',
    backgroundColor: '#fef2f2',
    color: '#b42318',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  tableWrap: {
    marginTop: '18px',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  headerCell: {
    padding: '12px 10px',
    borderBottom: '1px solid rgba(16, 24, 40, 0.08)',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  cell: {
    padding: '12px 10px',
    borderBottom: '1px solid rgba(16, 24, 40, 0.06)'
  },
  lowStockRow: {
    backgroundColor: '#fff7ed'
  },
  outOfStockRow: {
    backgroundColor: '#fff1f2'
  },
  nameCell: {
    display: 'grid',
    gap: '8px'
  },
  actionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  actionsCellStack: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  fullWidthButton: {
    width: '100%'
  },
  tableInput: {
    width: '100%',
    minHeight: '40px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#ffffff',
    fontSize: '14px',
    color: '#111827',
    boxSizing: 'border-box'
  },
  tableInputLow: {
    borderColor: 'rgba(249, 115, 22, 0.45)',
    backgroundColor: '#fff7ed'
  },
  tableInputOut: {
    borderColor: 'rgba(244, 63, 94, 0.45)',
    backgroundColor: '#fff1f2'
  },
  stockEditor: {
    display: 'grid',
    gap: '6px'
  },
  mobileCardList: {
    marginTop: '18px',
    display: 'grid',
    gap: '14px'
  },
  mobileCard: {
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    backgroundColor: '#f8fafc',
    display: 'grid',
    gap: '14px'
  },
  mobileCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  mobileCardTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#111827'
  },
  mobileFieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px'
  },
  mobileField: {
    display: 'grid',
    gap: '6px'
  },
  mobileLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  stockTag: {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  stockTagLow: {
    backgroundColor: '#ffedd5',
    color: '#c2410c'
  },
  stockTagOut: {
    backgroundColor: '#ffe4e6',
    color: '#be123c'
  },
  stockHelpText: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#b45309'
  }
};
