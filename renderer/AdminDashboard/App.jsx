import React, { useEffect, useMemo, useState } from 'react';
import ProductManager from './ProductManager.jsx';

const adminConfig = window.__ADMIN_CONFIG__ || {};
const refreshIntervalMs = Number(adminConfig.refreshMs) || 45000;
const API_KEY_STORAGE_KEY = 'pos-admin-api-key';

function createApiUrl(pathname) {
  const baseUrl = String(adminConfig.apiBaseUrl || '').trim();

  if (!baseUrl) {
    return pathname;
  }

  return `${baseUrl}${pathname}`;
}

async function fetchJson(pathname, apiKey) {
  const response = await fetch(createApiUrl(pathname), {
    headers: {
      'x-api-key': apiKey
    }
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new Error(`Request failed for ${pathname}: ${response.status}`);
  }

  return response.json();
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString();
}

function SummaryCard({ label, value, tone = 'neutral' }) {
  return (
    <article
      style={{
        ...styles.card,
        ...(tone === 'primary' ? styles.cardPrimary : {}),
        ...(tone === 'accent' ? styles.cardAccent : {})
      }}
    >
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </article>
  );
}

function EmptyState({ title, message }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyTitle}>{title}</div>
      <div style={styles.emptyMessage}>{message}</div>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  });
  const [draftApiKey, setDraftApiKey] = useState(() => {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  });
  const [salesData, setSalesData] = useState({
    summary: {
      salesCount: 0,
      totalAmount: 0,
      totalCost: 0,
      profit: 0
    },
    daily: [],
    topProducts: [],
    lastSyncTime: null
  });
  const [inventoryData, setInventoryData] = useState({
    inventory: [],
    lastSyncTime: null
  });
  const [productsData, setProductsData] = useState({
    products: [],
    serverTime: null
  });
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [statusMessage, setStatusMessage] = useState(
    apiKey ? 'Connecting to admin API...' : 'Enter your admin API key to load data'
  );
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inventorySummary = useMemo(() => {
    const inventoryRows = inventoryData.inventory || [];
    return inventoryRows.reduce(
      (summary, item) => {
        summary.totalProducts += 1;
        summary.totalUnits += Number(item.stock || 0);
        return summary;
      },
      { totalProducts: 0, totalUnits: 0 }
    );
  }, [inventoryData]);

  async function loadDashboard(activeApiKey) {
    if (!activeApiKey) {
      return;
    }

    setIsLoading(true);

    try {
      const [sales, inventory, products] = await Promise.all([
        fetchJson('/sales', activeApiKey),
        fetchJson('/inventory', activeApiKey),
        fetchJson('/products', activeApiKey)
      ]);

      setSalesData(sales);
      setInventoryData(inventory);
      setProductsData(products);
      setLastRefreshTime(new Date().toISOString());
      setStatusMessage('Dashboard up to date');
      setHasError(false);
    } catch (error) {
      console.error('Admin dashboard refresh failed:', error);

      if (error.message === 'UNAUTHORIZED') {
        setStatusMessage('API key rejected. Enter a valid key to continue.');
        setHasError(true);
        window.localStorage.removeItem(API_KEY_STORAGE_KEY);
        setApiKey('');
        return;
      }

      setStatusMessage('Unable to refresh dashboard');
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!apiKey) {
      return undefined;
    }

    let isMounted = true;

    async function refresh() {
      if (!isMounted) {
        return;
      }

      await loadDashboard(apiKey);
    }

    refresh();
    const intervalId = window.setInterval(refresh, refreshIntervalMs);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [apiKey]);

  function handleApiKeySave(event) {
    event.preventDefault();
    const trimmedKey = draftApiKey.trim();

    if (!trimmedKey) {
      setStatusMessage('Enter an admin API key to continue.');
      setHasError(true);
      return;
    }

    window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
    setApiKey(trimmedKey);
    setStatusMessage('Connecting to admin API...');
    setHasError(false);
  }

  function handleApiKeyReset() {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey('');
    setDraftApiKey('');
    setSalesData({
      summary: {
        salesCount: 0,
        totalAmount: 0,
        totalCost: 0,
        profit: 0
      },
      daily: [],
      topProducts: [],
      lastSyncTime: null
    });
    setInventoryData({
      inventory: [],
      lastSyncTime: null
    });
    setProductsData({
      products: [],
      serverTime: null
    });
    setLastRefreshTime(null);
    setStatusMessage('Enter your admin API key to load data');
    setHasError(false);
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.badge}>Admin Dashboard</div>
            <h1 style={styles.title}>Sales and inventory overview</h1>
            <p style={styles.subtitle}>
              Live-ish reporting from synced POS sales, current stock levels,
              and product performance across your offline checkout system.
            </p>
          </div>

          <aside
            style={{
              ...styles.statusPanel,
              ...(hasError ? styles.statusPanelError : {})
            }}
          >
            <div style={styles.statusLabel}>Status</div>
            <div style={styles.statusValue}>{statusMessage}</div>
            <div style={styles.statusMeta}>
              Last refresh: {formatDateTime(lastRefreshTime)}
            </div>
            <div style={styles.statusMeta}>
              Last sales sync: {formatDateTime(salesData.lastSyncTime)}
            </div>
            <div style={styles.statusMeta}>
              Last inventory sync: {formatDateTime(inventoryData.lastSyncTime)}
            </div>
            <div style={styles.statusMeta}>
              Refresh interval: {Math.round(refreshIntervalMs / 1000)} seconds
            </div>
          </aside>
        </header>

        <section style={styles.authPanel}>
          <div>
            <div style={styles.panelTitle}>Admin access</div>
            <div style={styles.authMeta}>
              Use the same API key configured on the backend. The key stays in
              this browser only.
            </div>
          </div>

          <form style={styles.authForm} onSubmit={handleApiKeySave}>
            <input
              type="password"
              value={draftApiKey}
              onChange={(event) => setDraftApiKey(event.target.value)}
              placeholder="Enter admin API key"
              style={styles.authInput}
              autoComplete="off"
            />
            <button type="submit" style={styles.authButton}>
              Connect
            </button>
            <button
              type="button"
              style={styles.authButtonSecondary}
              onClick={handleApiKeyReset}
            >
              Clear
            </button>
          </form>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard
            label="Total sales"
            value={salesData.summary.salesCount || 0}
          />
          <SummaryCard
            label="Revenue"
            value={formatCurrency(salesData.summary.totalAmount)}
            tone="primary"
          />
          <SummaryCard
            label="Profit"
            value={formatCurrency(salesData.summary.profit)}
            tone="accent"
          />
          <SummaryCard
            label="Units in stock"
            value={inventorySummary.totalUnits}
          />
        </section>

        <section style={styles.mainGrid}>
          <section style={styles.panel}>
            <div style={styles.panelTitle}>Daily sales</div>
            {salesData.daily.length === 0 ? (
              <EmptyState
                title={apiKey ? 'No synced sales yet' : 'Dashboard locked'}
                message={
                  apiKey
                    ? 'Sales will appear here after the POS sync service uploads pending checkouts.'
                    : 'Enter a valid admin API key to view daily totals.'
                }
              />
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.headerCell}>Date</th>
                      <th style={styles.headerCell}>Sales</th>
                      <th style={styles.headerCell}>Revenue</th>
                      <th style={styles.headerCell}>Cost</th>
                      <th style={styles.headerCell}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.daily.map((row) => (
                      <tr key={row.date}>
                        <td style={styles.cell}>{row.date}</td>
                        <td style={styles.cell}>{row.salesCount}</td>
                        <td style={styles.cell}>
                          {formatCurrency(row.totalAmount)}
                        </td>
                        <td style={styles.cell}>{formatCurrency(row.totalCost)}</td>
                        <td style={styles.cell}>{formatCurrency(row.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={styles.sideColumn}>
            <section style={styles.panel}>
              <div style={styles.panelTitle}>Top products</div>
              {salesData.topProducts.length === 0 ? (
                <EmptyState
                  title="No top sellers yet"
                  message="Top-selling products will appear once synced sales are available."
                />
              ) : (
                <div style={styles.listWrap}>
                  {salesData.topProducts.map((product) => (
                    <div key={product.productId} style={styles.listRow}>
                      <div>
                        <div style={styles.listTitle}>{product.productName}</div>
                        <div style={styles.listMeta}>
                          {product.quantitySold} sold
                        </div>
                      </div>
                      <div style={styles.listAmount}>
                        {formatCurrency(product.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.panelTitle}>Inventory snapshot</div>
              {inventoryData.inventory.length === 0 ? (
                <EmptyState
                  title="No synced inventory yet"
                  message="Inventory levels will populate after at least one successful sync."
                />
              ) : (
                <div style={styles.listWrap}>
                  {inventoryData.inventory.slice(0, 8).map((item) => (
                    <div
                      key={`${item.storeId}-${item.productId}`}
                      style={styles.listRow}
                    >
                      <div>
                        <div style={styles.listTitle}>{item.name}</div>
                        <div style={styles.listMeta}>
                          {item.barcode || 'No barcode'}
                        </div>
                      </div>
                      <div style={styles.stockPill}>{item.stock}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        </section>

        <ProductManager
          apiKey={apiKey}
          products={productsData.products || []}
          serverTime={productsData.serverTime}
          onRefreshRequested={() => loadDashboard(apiKey)}
        />

        <section style={styles.footerPanel}>
          <div>
            <div style={styles.footerTitle}>Catalog</div>
            <div style={styles.footerMeta}>
              {productsData.products.length} product records synced for admin
              management
            </div>
          </div>
          <button
            type="button"
            style={styles.refreshButton}
            onClick={() => loadDashboard(apiKey)}
            disabled={!apiKey || isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh now'}
          </button>
        </section>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '18px',
    background:
      'linear-gradient(180deg, #f4f7fb 0%, #edf2f8 50%, #e8eef6 100%)',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    color: '#111827',
    boxSizing: 'border-box'
  },
  shell: {
    maxWidth: '1360px',
    margin: '0 auto',
    display: 'grid',
    gap: '18px'
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    gap: '18px',
    alignItems: 'stretch'
  },
  badge: {
    display: 'inline-flex',
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
    margin: '16px 0 10px',
    fontSize: '34px',
    lineHeight: 1.08
  },
  subtitle: {
    margin: 0,
    maxWidth: '720px',
    fontSize: '15px',
    lineHeight: 1.55,
    color: '#475467'
  },
  statusPanel: {
    padding: '18px 20px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 22px rgba(16, 24, 40, 0.06)'
  },
  statusPanelError: {
    backgroundColor: '#fef2f2',
    borderColor: 'rgba(239, 68, 68, 0.18)'
  },
  statusLabel: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  statusValue: {
    marginTop: '8px',
    fontSize: '18px',
    fontWeight: 700
  },
  statusMeta: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#475467'
  },
  authPanel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    padding: '18px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)'
  },
  panelTitle: {
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#475467'
  },
  authMeta: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#667085'
  },
  authForm: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: '12px',
    minWidth: '320px'
  },
  authInput: {
    minWidth: '280px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#111827',
    outline: 'none'
  },
  authButton: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #2457c5 0%, #2f6fed 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  authButtonSecondary: {
    padding: '12px 16px',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    color: '#475467',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px'
  },
  card: {
    padding: '18px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)'
  },
  cardPrimary: {
    background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)',
    color: '#f8fafc'
  },
  cardAccent: {
    background: 'linear-gradient(135deg, #2457c5 0%, #2f6fed 100%)',
    color: '#f8fafc'
  },
  cardLabel: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0.72
  },
  cardValue: {
    marginTop: '10px',
    fontSize: '30px',
    fontWeight: 800,
    lineHeight: 1.05
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.85fr)',
    gap: '18px',
    alignItems: 'start'
  },
  sideColumn: {
    display: 'grid',
    gap: '18px'
  },
  panel: {
    padding: '18px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)'
  },
  tableWrap: {
    marginTop: '14px',
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
    padding: '14px 10px',
    borderBottom: '1px solid rgba(16, 24, 40, 0.06)',
    fontSize: '14px',
    color: '#111827'
  },
  listWrap: {
    marginTop: '14px',
    display: 'grid',
    gap: '10px'
  },
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    backgroundColor: '#f8fafc'
  },
  listTitle: {
    fontSize: '14px',
    fontWeight: 700
  },
  listMeta: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#667085'
  },
  listAmount: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#2457c5'
  },
  stockPill: {
    minWidth: '44px',
    padding: '8px 10px',
    borderRadius: '999px',
    backgroundColor: '#e8eef8',
    textAlign: 'center',
    fontWeight: 800,
    color: '#1f2937'
  },
  footerPanel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '18px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)'
  },
  footerTitle: {
    fontSize: '14px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#475467'
  },
  footerMeta: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#667085'
  },
  refreshButton: {
    padding: '12px 16px',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  emptyState: {
    display: 'grid',
    gap: '6px',
    placeItems: 'center',
    minHeight: '200px',
    textAlign: 'center',
    color: '#667085'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827'
  },
  emptyMessage: {
    maxWidth: '420px',
    fontSize: '14px',
    lineHeight: 1.55
  }
};
