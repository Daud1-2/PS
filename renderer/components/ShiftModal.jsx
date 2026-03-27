import React, { useEffect, useMemo, useRef, useState } from 'react';

function normalizeAmount(value) {
  return String(value ?? '').trim();
}

export default function ShiftModal({
  isOpen,
  mode,
  shift,
  summary,
  isSubmitting,
  canDismiss = true,
  onSubmit,
  onClose
}) {
  const inputRef = useRef(null);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');

  const config = useMemo(() => {
    if (mode === 'close') {
      return {
        badge: 'Close Shift',
        title: 'End active shift',
        subtitle:
          'Count the drawer physically and enter the actual cash amount. Audit totals stay in the admin panel.',
        label: 'Actual cash in drawer',
        buttonLabel: isSubmitting ? 'Closing shift...' : 'Close Shift',
        placeholder: '0.00'
      };
    }

    return {
      badge: 'Start Shift',
      title: 'Open cashier shift',
      subtitle: 'Enter the opening cash amount before starting sales.',
      label: 'Opening cash',
      buttonLabel: isSubmitting ? 'Opening shift...' : 'Start Shift',
      placeholder: '0.00'
    };
  }, [isSubmitting, mode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAmount('');
    setFormError('');

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
  }, [isOpen, mode]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    const normalizedAmount = normalizeAmount(amount);

    if (!normalizedAmount) {
      setFormError(`${config.label} is required.`);
      return;
    }

    try {
      setFormError('');
      await onSubmit?.(normalizedAmount);
    } catch (error) {
      setFormError(error?.message || 'Unable to save shift right now.');
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>{config.badge}</div>
            <h2 style={styles.title}>{config.title}</h2>
            <p style={styles.subtitle}>{config.subtitle}</p>
          </div>

          {canDismiss ? (
            <button type="button" onClick={onClose} style={styles.closeButton}>
              Close
            </button>
          ) : null}
        </div>

        {mode === 'close' ? (
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Shift ID</span>
              <strong style={styles.summaryValue}>#{shift?.id || '-'}</strong>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Closeout note</span>
              <strong style={styles.summaryValueCompact}>
                Enter only the counted drawer amount.
              </strong>
            </div>
          </div>
        ) : null}

        <label style={styles.field}>
          <span style={styles.label}>{config.label}</span>
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              if (formError) {
                setFormError('');
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSave();
              }
            }}
            placeholder={config.placeholder}
            style={styles.input}
          />
        </label>

        {formError ? <div style={styles.formError}>{formError}</div> : null}

        <div style={styles.footer}>
          {canDismiss ? (
            <button type="button" onClick={onClose} style={styles.secondaryButton}>
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSubmitting}
            style={{
              ...styles.primaryButton,
              ...(isSubmitting ? styles.disabledButton : {})
            }}
          >
            {config.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 120,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    display: 'grid',
    placeItems: 'center',
    padding: '24px'
  },
  modal: {
    width: '100%',
    maxWidth: '680px',
    padding: '24px',
    borderRadius: '24px',
    backgroundColor: '#ffffff',
    boxShadow: '0 30px 70px rgba(15, 23, 42, 0.24)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    display: 'grid',
    gap: '18px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px'
  },
  badge: {
    display: 'inline-flex',
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: '#e9f7ef',
    color: '#166534',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  title: {
    margin: '10px 0 8px',
    fontSize: '30px',
    lineHeight: 1.1,
    color: '#101828'
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#475467'
  },
  closeButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    backgroundColor: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    color: '#344054',
    cursor: 'pointer'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px'
  },
  summaryCard: {
    padding: '14px 16px',
    borderRadius: '16px',
    backgroundColor: '#f8fafc',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    display: 'grid',
    gap: '8px'
  },
  summaryHighlightCard: {
    background: 'linear-gradient(135deg, #fff8e1 0%, #ffe7b3 100%)',
    borderColor: 'rgba(245, 158, 11, 0.18)'
  },
  summaryLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#667085'
  },
  summaryValue: {
    fontSize: '24px',
    lineHeight: 1.1,
    color: '#101828'
  },
  summaryValueCompact: {
    fontSize: '16px',
    lineHeight: 1.4,
    color: '#101828'
  },
  field: {
    display: 'grid',
    gap: '8px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#475467'
  },
  input: {
    width: '100%',
    minHeight: '54px',
    padding: '12px 14px',
    borderRadius: '16px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    backgroundColor: '#f8fafc',
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    boxSizing: 'border-box',
    outline: 'none'
  },
  formError: {
    padding: '12px 14px',
    borderRadius: '14px',
    backgroundColor: '#fef2f2',
    color: '#b42318',
    fontSize: '13px',
    fontWeight: 600
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  secondaryButton: {
    minHeight: '46px',
    padding: '0 16px',
    borderRadius: '14px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    backgroundColor: '#ffffff',
    color: '#344054',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  primaryButton: {
    minHeight: '46px',
    padding: '0 18px',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #17312d 0%, #245248 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  disabledButton: {
    opacity: 0.7,
    cursor: 'not-allowed'
  }
};
