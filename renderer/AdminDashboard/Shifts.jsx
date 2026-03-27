import React, { useMemo, useState } from 'react';

function formatCurrency(value) {
  return `PKR ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleDateString();
}

function formatTime(value) {
  if (!value) {
    return 'Open';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getAuditStatus(shift) {
  if (shift.status === 'open') {
    return 'Open Shift';
  }

  return Number(shift.difference || 0) === 0 ? 'Balanced' : 'Mismatch';
}

export default function Shifts({ shifts, lastSyncTime, isLoading }) {
  const [selectedShiftId, setSelectedShiftId] = useState(null);

  const selectedShift = useMemo(() => {
    if (!selectedShiftId) {
      return null;
    }

    return shifts.find((shift) => shift.id === selectedShiftId) || null;
  }, [selectedShiftId, shifts]);

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <div style={styles.title}>Shift monitoring</div>
          <div style={styles.meta}>
            Audit-style review of opening cash, expected totals, and variances.
          </div>
        </div>
        <div style={styles.syncMeta}>
          Last shift sync:{' '}
          {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Not available'}
        </div>
      </header>

      {isLoading ? (
        <div style={styles.emptyState}>Loading shifts...</div>
      ) : shifts.length === 0 ? (
        <div style={styles.emptyState}>No shifts have been synced yet.</div>
      ) : (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.headerCell}>Date</th>
                  <th style={styles.headerCell}>Start Time</th>
                  <th style={styles.headerCell}>End Time</th>
                  <th style={styles.headerCell}>Total Sales</th>
                  <th style={styles.headerCell}>Expected Cash</th>
                  <th style={styles.headerCell}>Actual Cash</th>
                  <th style={styles.headerCell}>Difference</th>
                  <th style={styles.headerCell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => {
                  const auditStatus = getAuditStatus(shift);
                  const isMismatch =
                    shift.status === 'closed' && Number(shift.difference || 0) !== 0;
                  const isSelected = selectedShiftId === shift.id;

                  return (
                    <tr
                      key={shift.id}
                      onClick={() =>
                        setSelectedShiftId((current) =>
                          current === shift.id ? null : shift.id
                        )
                      }
                      style={{
                        ...(isMismatch ? styles.mismatchRow : {}),
                        ...(isSelected ? styles.selectedRow : {}),
                        cursor: 'pointer'
                      }}
                    >
                      <td style={styles.cell}>{formatDate(shift.start_time)}</td>
                      <td style={styles.cell}>{formatTime(shift.start_time)}</td>
                      <td style={styles.cell}>{formatTime(shift.end_time)}</td>
                      <td style={styles.cell}>{formatCurrency(shift.total_sales)}</td>
                      <td style={styles.cell}>{formatCurrency(shift.expected_cash)}</td>
                      <td style={styles.cell}>
                        {shift.closing_cash === null
                          ? 'Open'
                          : formatCurrency(shift.closing_cash)}
                      </td>
                      <td
                        style={{
                          ...styles.cell,
                          ...(isMismatch ? styles.mismatchText : styles.balancedText)
                        }}
                      >
                        {formatCurrency(shift.difference)}
                      </td>
                      <td style={styles.cell}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(auditStatus === 'Balanced'
                              ? styles.statusBalanced
                              : auditStatus === 'Mismatch'
                                ? styles.statusMismatch
                                : styles.statusOpen)
                          }}
                        >
                          {auditStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedShift ? (
            <section style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div style={styles.detailTitle}>Shift #{selectedShift.id}</div>
                <div
                  style={{
                    ...styles.statusBadge,
                    ...(getAuditStatus(selectedShift) === 'Balanced'
                      ? styles.statusBalanced
                      : getAuditStatus(selectedShift) === 'Mismatch'
                        ? styles.statusMismatch
                        : styles.statusOpen)
                  }}
                >
                  {getAuditStatus(selectedShift)}
                </div>
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Opening cash</span>
                  <strong style={styles.detailValue}>
                    {formatCurrency(selectedShift.opening_cash)}
                  </strong>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Closing cash</span>
                  <strong style={styles.detailValue}>
                    {selectedShift.closing_cash === null
                      ? 'Still open'
                      : formatCurrency(selectedShift.closing_cash)}
                  </strong>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Total sales</span>
                  <strong style={styles.detailValue}>
                    {formatCurrency(selectedShift.total_sales)}
                  </strong>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Expected cash</span>
                  <strong style={styles.detailValue}>
                    {formatCurrency(selectedShift.expected_cash)}
                  </strong>
                </div>
              </div>
            </section>
          ) : null}
        </>
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
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap'
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
    fontSize: '14px',
    color: '#667085'
  },
  syncMeta: {
    fontSize: '13px',
    color: '#667085'
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
    padding: '14px 10px',
    borderBottom: '1px solid rgba(16, 24, 40, 0.06)',
    fontSize: '14px',
    color: '#111827'
  },
  mismatchRow: {
    backgroundColor: '#fff1f2'
  },
  selectedRow: {
    boxShadow: 'inset 3px 0 0 #2457c5'
  },
  mismatchText: {
    color: '#b42318',
    fontWeight: 800
  },
  balancedText: {
    color: '#166534',
    fontWeight: 700
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '30px',
    padding: '0 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  statusBalanced: {
    backgroundColor: '#ecfdf3',
    color: '#166534'
  },
  statusMismatch: {
    backgroundColor: '#fef2f2',
    color: '#b42318'
  },
  statusOpen: {
    backgroundColor: '#eef4ff',
    color: '#2457c5'
  },
  detailCard: {
    marginTop: '18px',
    padding: '16px 18px',
    borderRadius: '16px',
    backgroundColor: '#f8fafc',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    display: 'grid',
    gap: '14px'
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  },
  detailTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#111827'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px'
  },
  detailItem: {
    display: 'grid',
    gap: '8px',
    padding: '14px 16px',
    borderRadius: '14px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.06)'
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  detailValue: {
    fontSize: '20px',
    color: '#111827'
  },
  emptyState: {
    marginTop: '18px',
    minHeight: '220px',
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    color: '#667085',
    fontSize: '14px'
  }
};
