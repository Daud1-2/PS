import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createProductDraft,
  validateProductDraft
} from './ProductForm.jsx';

export default function QuickAddProduct({
  isOpen,
  barcode,
  onClose,
  onSave
}) {
  const [draft, setDraft] = useState(
    createProductDraft(
      {
        barcode
      },
      {
        defaultStock: 1
      }
    )
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const nameRef = useRef(null);
  const sellingPriceRef = useRef(null);
  const costPriceRef = useRef(null);
  const stockRef = useRef(null);

  const fieldRefs = useMemo(
    () => [nameRef, sellingPriceRef, costPriceRef, stockRef],
    []
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(
      createProductDraft(
        {
          barcode
        },
        {
          defaultStock: 1
        }
      )
    );
    setErrors({});
    setFormError('');
    setIsSaving(false);

    window.requestAnimationFrame(() => {
      nameRef.current?.focus();
    });
  }, [isOpen, barcode]);

  if (!isOpen) {
    return null;
  }

  const updateField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));

    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: ''
      };
    });

    if (formError) {
      setFormError('');
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (index === fieldRefs.length - 1) {
      void handleSave();
      return;
    }

    const nextRef = fieldRefs[index + 1];
    nextRef.current?.focus();
    nextRef.current?.select?.();
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const validation = validateProductDraft(draft);

    if (!validation.payload) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setFormError('');
    setIsSaving(true);

    try {
      await onSave?.(validation.payload);
    } catch (error) {
      setFormError(error?.message || 'Unable to add product.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>Product not found</div>
            <h2 style={styles.title}>Quick add product</h2>
            <p style={styles.subtitle}>
              Save the scanned item and add it to the current cart instantly.
            </p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            Close
          </button>
        </div>

        <div style={styles.grid}>
          <label style={styles.field}>
            <span style={styles.label}>Barcode</span>
            <input type="text" value={draft.barcode} readOnly style={styles.readOnlyInput} />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Product Name</span>
            <input
              ref={nameRef}
              type="text"
              value={draft.name}
              onChange={(event) => updateField('name', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 0)}
              style={styles.input}
            />
            {errors.name ? <span style={styles.error}>{errors.name}</span> : null}
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Selling Price</span>
            <input
              ref={sellingPriceRef}
              type="number"
              step="0.01"
              value={draft.sellingPrice}
              onChange={(event) => updateField('sellingPrice', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 1)}
              style={styles.input}
            />
            {errors.sellingPrice ? (
              <span style={styles.error}>{errors.sellingPrice}</span>
            ) : null}
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Cost Price</span>
            <input
              ref={costPriceRef}
              type="number"
              step="0.01"
              value={draft.costPrice}
              onChange={(event) => updateField('costPrice', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 2)}
              style={styles.input}
            />
            {errors.costPrice ? (
              <span style={styles.error}>{errors.costPrice}</span>
            ) : null}
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Stock</span>
            <input
              ref={stockRef}
              type="number"
              step="1"
              value={draft.stock}
              onChange={(event) => updateField('stock', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 3)}
              style={styles.input}
            />
            {errors.stock ? <span style={styles.error}>{errors.stock}</span> : null}
          </label>
        </div>

        {formError ? <div style={styles.formError}>{formError}</div> : null}

        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
            style={{
              ...styles.primaryButton,
              ...(isSaving ? styles.disabledButton : {})
            }}
          >
            {isSaving ? 'Saving...' : 'Save and add to cart'}
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
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    display: 'grid',
    placeItems: 'center',
    padding: '24px'
  },
  modal: {
    width: '100%',
    maxWidth: '760px',
    padding: '24px',
    borderRadius: '22px',
    backgroundColor: '#ffffff',
    boxShadow: '0 28px 60px rgba(15, 23, 42, 0.24)',
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
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: '#fef2f2',
    color: '#b42318',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  title: {
    margin: '10px 0 8px',
    fontSize: '28px',
    lineHeight: 1.1,
    color: '#101828'
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px'
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
    fontSize: '15px',
    color: '#101828',
    boxSizing: 'border-box'
  },
  readOnlyInput: {
    width: '100%',
    minHeight: '50px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(36, 87, 197, 0.18)',
    backgroundColor: '#eef4ff',
    fontSize: '15px',
    fontWeight: 700,
    color: '#2457c5',
    boxSizing: 'border-box'
  },
  error: {
    fontSize: '12px',
    color: '#b42318'
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
    background: 'linear-gradient(135deg, #2f6fed 0%, #2457c5 100%)',
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
