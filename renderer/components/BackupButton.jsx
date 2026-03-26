import React from 'react';

export default function BackupButton({
  disabled,
  isBackingUp,
  onBackup,
  backupStatus
}) {
  return (
    <div style={styles.wrapper}>
      <button
        type="button"
        onClick={onBackup}
        disabled={disabled || isBackingUp}
        style={{
          ...styles.button,
          ...(disabled || isBackingUp ? styles.disabled : {})
        }}
      >
        {isBackingUp ? 'Backing up...' : 'Backup DB'}
      </button>
      <span
        style={{
          ...styles.status,
          ...(backupStatus === 'success' ? styles.statusSuccess : {}),
          ...(backupStatus === 'error' ? styles.statusError : {})
        }}
      >
        {backupStatus === 'success'
          ? 'Backup saved'
          : backupStatus === 'error'
            ? 'Backup failed'
            : 'Daily backup active'}
      </span>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  button: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid rgba(16, 24, 40, 0.12)',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  disabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  status: {
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: '#f8fafc',
    color: '#667085',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  statusSuccess: {
    backgroundColor: '#ecfdf3',
    color: '#166534'
  },
  statusError: {
    backgroundColor: '#fef2f2',
    color: '#b42318'
  }
};
