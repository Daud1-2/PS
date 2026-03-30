import React, { useEffect, useRef, useState } from 'react';

export default function PinLockModal({
  isOpen,
  title = 'Enter PIN',
  description = 'Enter the PIN to continue.',
  expectedPin,
  onClose,
  onSuccess
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPin('');
    setError('');

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    if (String(pin).trim() === String(expectedPin)) {
      setPin('');
      setError('');
      onSuccess?.();
      return;
    }

    setError('Incorrect PIN.');
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Protected Action</div>
            <h2 style={styles.title}>{title}</h2>
            <p style={styles.description}>{description}</p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            Close
          </button>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>PIN</span>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              if (error) {
                setError('');
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
            style={styles.input}
          />
          {error ? <span style={styles.error}>{error}</span> : null}
        </label>

        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} style={styles.primaryButton}>
            Unlock Add Product
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
    zIndex: 90,
    backgroundColor: 'rgba(15, 23, 42, 0.44)',
    display: 'grid',
    placeItems: 'center',
    padding: '24px'
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    padding: '24px',
    borderRadius: '22px',
    backgroundColor: '#ffffff',
    boxShadow: '0 28px 60px rgba(15, 23, 42, 0.22)',
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
  eyebrow: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#c2410c'
  },
  title: {
    margin: '8px 0 8px',
    fontSize: '26px',
    lineHeight: 1.15,
    color: '#101828'
  },
  description: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.5,
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
    minHeight: '50px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    backgroundColor: '#f8fafc',
    fontSize: '20px',
    letterSpacing: '0.2em',
    color: '#101828',
    boxSizing: 'border-box',
    outline: 'none'
  },
  error: {
    fontSize: '12px',
    color: '#b42318'
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
  }
};
