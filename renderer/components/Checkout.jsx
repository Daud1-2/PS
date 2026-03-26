import React from 'react';
import BackupButton from './BackupButton.jsx';

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

export default function Checkout({
  totalAmount,
  totalItems,
  checkoutDisabled,
  clearDisabled,
  canReprint,
  isCheckingOut,
  isPrinting,
  isBackingUp,
  printStatus,
  backupStatus,
  onCheckout,
  onClearCart,
  onReprint,
  onBackup
}) {
  return (
    <section style={styles.shell}>
      <div style={styles.metaGroup}>
        <div style={styles.metaCard}>
          <span style={styles.metaLabel}>Items</span>
          <strong style={styles.metaValue}>{totalItems}</strong>
        </div>

        <div style={styles.totalCard}>
          <span style={styles.metaLabel}>Total</span>
          <strong style={styles.totalValue}>{formatCurrency(totalAmount)}</strong>
        </div>
      </div>

      <div style={styles.actionGroup}>
        <button
          type="button"
          onClick={onClearCart}
          disabled={clearDisabled}
          style={{
            ...styles.secondaryButton,
            ...(clearDisabled ? styles.disabledButton : {})
          }}
        >
          Clear Cart
        </button>

        <button
          type="button"
          onClick={onReprint}
          disabled={!canReprint || isPrinting || isCheckingOut}
          style={{
            ...styles.secondaryButton,
            ...styles.reprintButton,
            ...(!canReprint || isPrinting || isCheckingOut
              ? styles.disabledButton
              : {})
          }}
        >
          {isPrinting ? 'Printing...' : 'Reprint Receipt'}
        </button>

        <button
          type="button"
          onClick={onCheckout}
          disabled={checkoutDisabled}
          style={{
            ...styles.primaryButton,
            ...(checkoutDisabled ? styles.disabledButton : {})
          }}
        >
          {isCheckingOut ? 'Saving Sale...' : 'Checkout'}
        </button>
      </div>

      <div style={styles.shortcutRow}>
        <div style={styles.shortcutGroup}>
          <span style={styles.shortcutText}>F9 checkout | Esc clear cart</span>
          <span
            style={{
              ...styles.printStatus,
              ...(printStatus === 'printed' ? styles.printStatusSuccess : {}),
              ...(printStatus === 'failed' ? styles.printStatusError : {})
            }}
          >
            {printStatus === 'printed'
              ? 'Receipt printed'
              : printStatus === 'failed'
                ? 'Print failed'
                : 'Ready to print'}
          </span>
        </div>

        <BackupButton
          disabled={isCheckingOut || isPrinting}
          isBackingUp={isBackingUp}
          onBackup={onBackup}
          backupStatus={backupStatus}
        />
      </div>
    </section>
  );
}

const styles = {
  shell: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '18px',
    padding: '16px 18px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 10px 28px rgba(16, 24, 40, 0.07)'
  },
  metaGroup: {
    display: 'grid',
    gridTemplateColumns: '140px minmax(0, 1fr)',
    gap: '14px',
    alignItems: 'stretch'
  },
  metaCard: {
    padding: '14px 16px',
    borderRadius: '14px',
    backgroundColor: '#f8fafc',
    display: 'grid',
    alignContent: 'center'
  },
  totalCard: {
    padding: '14px 18px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
    color: '#f8fafc',
    display: 'grid',
    alignContent: 'center'
  },
  metaLabel: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'inherit',
    opacity: 0.72
  },
  metaValue: {
    marginTop: '6px',
    fontSize: '24px',
    lineHeight: 1,
    color: '#101828'
  },
  totalValue: {
    marginTop: '6px',
    fontSize: '34px',
    lineHeight: 1
  },
  actionGroup: {
    display: 'grid',
    gridTemplateColumns: '150px 170px 200px',
    gap: '10px',
    alignItems: 'stretch'
  },
  secondaryButton: {
    minHeight: '56px',
    borderRadius: '14px',
    border: '1px solid rgba(16, 24, 40, 0.12)',
    backgroundColor: '#f8fafc',
    color: '#111827',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  reprintButton: {
    backgroundColor: '#eef6ff',
    color: '#2457c5'
  },
  primaryButton: {
    minHeight: '56px',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #2f6fed 0%, #2356ba 100%)',
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(47, 111, 237, 0.24)'
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  shortcutRow: {
    gridColumn: '1 / -1',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px'
  },
  shortcutGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  shortcutText: {
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  printStatus: {
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: '#f8fafc',
    color: '#667085',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  printStatusSuccess: {
    backgroundColor: '#ecfdf3',
    color: '#166534'
  },
  printStatusError: {
    backgroundColor: '#fef2f2',
    color: '#b42318'
  }
};
