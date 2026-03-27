import React from 'react';
import BackupButton from './BackupButton.jsx';

function formatCurrency(value) {
  return `PKR ${Number(value || 0).toFixed(2)}`;
}

export default function Checkout({
  totalAmount,
  totalItems,
  checkoutDisabled,
  clearDisabled,
  holdDisabled,
  canReprint,
  holdLabel = 'Hold Sale',
  isCheckingOut,
  isPrinting,
  isBackingUp,
  isOpeningDrawer,
  printStatus,
  backupStatus,
  onCheckout,
  onHold,
  onClearCart,
  onReprint,
  onOpenDrawer,
  onBackup,
  tone = 'light'
}) {
  const isDark = tone === 'dark';

  return (
    <section style={{ ...styles.shell, ...(isDark ? styles.shellDark : {}) }}>
      <div style={styles.metaGroup}>
        <div style={{ ...styles.metaCard, ...(isDark ? styles.metaCardDark : {}) }}>
          <span style={{ ...styles.metaLabel, ...(isDark ? styles.metaLabelDark : {}) }}>
            Items
          </span>
          <strong style={{ ...styles.metaValue, ...(isDark ? styles.metaValueDark : {}) }}>
            {totalItems}
          </strong>
        </div>

        <div style={styles.totalCard}>
          <span style={styles.totalLabel}>Total</span>
          <strong style={styles.totalValue}>{formatCurrency(totalAmount)}</strong>
        </div>
      </div>

      <div style={styles.actionGroup}>
        <button
          type="button"
          onClick={onCheckout}
          disabled={checkoutDisabled}
          style={{
            ...styles.primaryButton,
            ...(checkoutDisabled ? styles.disabledButton : {})
          }}
        >
          {isCheckingOut ? 'Saving Sale...' : 'Charge Customer'}
        </button>

        <div style={styles.secondaryRow}>
          <button
            type="button"
            onClick={onHold}
            disabled={holdDisabled}
            style={{
              ...styles.secondaryButton,
              ...(isDark ? styles.secondaryButtonDark : {}),
              ...(holdDisabled ? styles.disabledButton : {})
            }}
          >
            {holdLabel}
          </button>

          <button
            type="button"
            onClick={onClearCart}
            disabled={clearDisabled}
            style={{
              ...styles.secondaryButton,
              ...(isDark ? styles.secondaryButtonDark : {}),
              ...(clearDisabled ? styles.disabledButton : {})
            }}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={onReprint}
            disabled={!canReprint || isPrinting || isCheckingOut}
            style={{
              ...styles.secondaryButton,
              ...(isDark ? styles.secondaryButtonDark : {}),
              ...(!canReprint || isPrinting || isCheckingOut
                ? styles.disabledButton
                : {})
            }}
          >
            {isPrinting ? 'Printing...' : 'Reprint'}
          </button>

          <button
            type="button"
            onClick={onOpenDrawer}
            disabled={isOpeningDrawer || isCheckingOut || isPrinting}
            style={{
              ...styles.secondaryButton,
              ...(isDark ? styles.secondaryButtonDark : {}),
              ...(isOpeningDrawer || isCheckingOut || isPrinting
                ? styles.disabledButton
                : {})
            }}
          >
            {isOpeningDrawer ? 'Opening...' : 'Open Drawer'}
          </button>
        </div>
      </div>

      <div style={styles.bottomRow}>
        <div style={styles.shortcutGroup}>
          <span style={{ ...styles.shortcutText, ...(isDark ? styles.shortcutTextDark : {}) }}>
            F9 checkout | Esc clear cart
          </span>
          <span
            style={{
              ...styles.printStatus,
              ...(isDark ? styles.printStatusDark : {}),
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
          tone={tone}
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
    gap: '14px'
  },
  shellDark: {
    color: '#ffffff'
  },
  metaGroup: {
    display: 'grid',
    gridTemplateColumns: '120px minmax(0, 1fr)',
    gap: '12px'
  },
  metaCard: {
    padding: '14px 16px',
    borderRadius: '16px',
    backgroundColor: '#f8fafc',
    display: 'grid',
    alignContent: 'center'
  },
  metaCardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  metaLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  metaLabelDark: {
    color: '#8fb2a5'
  },
  metaValue: {
    marginTop: '6px',
    fontSize: '24px',
    lineHeight: 1,
    color: '#101828'
  },
  metaValueDark: {
    color: '#ffffff'
  },
  totalCard: {
    padding: '14px 18px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #f3b14b 0%, #f8c45e 100%)',
    color: '#21312d',
    display: 'grid',
    alignContent: 'center'
  },
  totalLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0.7
  },
  totalValue: {
    marginTop: '6px',
    fontSize: '30px',
    lineHeight: 1,
    fontWeight: 900
  },
  actionGroup: {
    display: 'grid',
    gap: '10px'
  },
  primaryButton: {
    minHeight: '54px',
    borderRadius: '18px',
    border: 'none',
    background: 'linear-gradient(135deg, #f3b14b 0%, #f8bc4f 100%)',
    color: '#21312d',
    fontSize: '17px',
    fontWeight: 900,
    cursor: 'pointer'
  },
  secondaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px'
  },
  secondaryButton: {
    minHeight: '46px',
    borderRadius: '16px',
    border: '1px solid rgba(16, 24, 40, 0.12)',
    backgroundColor: '#f8fafc',
    color: '#111827',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer'
  },
  secondaryButtonDark: {
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#f5f1e8'
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  shortcutGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  shortcutText: {
    fontSize: '11px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  shortcutTextDark: {
    color: '#8fb2a5'
  },
  printStatus: {
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: '#f8fafc',
    color: '#667085',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  printStatusDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#d7e3dc'
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
