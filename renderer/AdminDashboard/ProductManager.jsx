import React, { useEffect, useMemo, useState } from 'react';

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
  onRefreshRequested
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

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
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

      <form style={styles.createGrid} onSubmit={handleCreate}>
        <input
          type="text"
          value={createForm.name}
          onChange={(event) => updateCreateField('name', event.target.value)}
          placeholder="Product name"
          style={styles.input}
        />
        <input
          type="text"
          value={createForm.barcode}
          onChange={(event) => updateCreateField('barcode', event.target.value)}
          placeholder="Barcode"
          style={styles.input}
        />
        <input
          type="number"
          step="0.01"
          value={createForm.costPrice}
          onChange={(event) => updateCreateField('costPrice', event.target.value)}
          placeholder="Cost price"
          style={styles.input}
        />
        <input
          type="number"
          step="0.01"
          value={createForm.sellingPrice}
          onChange={(event) =>
            updateCreateField('sellingPrice', event.target.value)
          }
          placeholder="Selling price"
          style={styles.input}
        />
        <input
          type="number"
          step="1"
          value={createForm.stock}
          onChange={(event) => updateCreateField('stock', event.target.value)}
          placeholder="Stock"
          style={styles.input}
        />
        <button type="submit" style={styles.primaryButton} disabled={!apiKey || isSaving}>
          {isSaving ? 'Saving...' : 'Add product'}
        </button>
      </form>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.headerCell}>Name</th>
              <th style={styles.headerCell}>Barcode</th>
              <th style={styles.headerCell}>Cost</th>
              <th style={styles.headerCell}>Sell</th>
              <th style={styles.headerCell}>Stock</th>
              <th style={styles.headerCell}>Save</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => {
              const draft = drafts[product.id] || createDraft(product);

              return (
                <tr key={product.id}>
                  <td style={styles.cell}>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) =>
                        updateDraft(product.id, 'name', event.target.value)
                      }
                      style={styles.tableInput}
                    />
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
                    <input
                      type="number"
                      step="1"
                      value={draft.stock}
                      onChange={(event) =>
                        updateDraft(product.id, 'stock', event.target.value)
                      }
                      style={styles.tableInput}
                    />
                  </td>
                  <td style={styles.cell}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => handleSave(product.id)}
                      disabled={!apiKey || isSaving}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  }
};
