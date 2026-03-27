import React, { useEffect, useMemo, useRef, useState } from 'react';

function createDraft(product) {
  const hasPrice =
    product?.sellingPrice !== null && product?.sellingPrice !== undefined;
  const hasRealStock =
    product?.stock !== null &&
    product?.stock !== undefined &&
    (Number(product.stock) > 0 || hasPrice);

  return {
    price:
      hasPrice
        ? String(product.sellingPrice)
        : '',
    cost:
      product?.costPrice !== null && product?.costPrice !== undefined
        ? String(product.costPrice)
        : '',
    stock: hasRealStock ? String(product.stock) : ''
  };
}

function validateDraft(draft) {
  const errors = {};
  const payload = {
    sellingPrice: Number(draft?.price),
    costPrice:
      String(draft?.cost || '').trim() === '' ? null : Number(draft?.cost),
    stock: Number.parseInt(String(draft?.stock || '').trim(), 10)
  };

  if (!Number.isFinite(payload.sellingPrice)) {
    errors.price = 'Price is required.';
  }

  if (payload.costPrice !== null && !Number.isFinite(payload.costPrice)) {
    errors.cost = 'Cost must be numeric.';
  }

  if (!Number.isInteger(payload.stock) || payload.stock < 0) {
    errors.stock = 'Stock is required.';
  }

  return {
    errors,
    payload: Object.keys(errors).length === 0 ? payload : null
  };
}

export default function ProductCompletionModal({
  isOpen,
  product,
  onClose,
  onSave
}) {
  const [draft, setDraft] = useState(createDraft(product));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const priceRef = useRef(null);
  const costRef = useRef(null);
  const stockRef = useRef(null);

  const fieldRefs = useMemo(() => [priceRef, costRef, stockRef], []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(createDraft(product));
    setErrors({});
    setFormError('');
    setIsSaving(false);

    window.requestAnimationFrame(() => {
      priceRef.current?.focus();
      priceRef.current?.select?.();
    });
  }, [isOpen, product]);

  if (!isOpen || !product) {
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

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
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

    const validation = validateDraft(draft);

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
      setFormError(error?.message || 'Unable to save product details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>Complete Product Info</div>
            <h2 style={styles.title}>Finish setup and keep scanning</h2>
            <p style={styles.subtitle}>
              This barcode already exists locally. Add the missing sellable details and
              it will jump straight into the current cart.
            </p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            Close
          </button>
        </div>

        <div style={styles.grid}>
          <label style={styles.field}>
            <span style={styles.label}>Product Name</span>
            <input type="text" value={product.name} readOnly style={styles.readOnlyInput} />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Barcode</span>
            <input
              type="text"
              value={product.barcode}
              readOnly
              style={styles.readOnlyInput}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Price</span>
            <input
              ref={priceRef}
              type="number"
              step="0.01"
              value={draft.price}
              onChange={(event) => updateField('price', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 0)}
              style={styles.input}
            />
            {errors.price ? <span style={styles.error}>{errors.price}</span> : null}
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Cost</span>
            <input
              ref={costRef}
              type="number"
              step="0.01"
              value={draft.cost}
              onChange={(event) => updateField('cost', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 1)}
              style={styles.input}
            />
            {errors.cost ? <span style={styles.error}>{errors.cost}</span> : null}
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Stock</span>
            <input
              ref={stockRef}
              type="number"
              step="1"
              value={draft.stock}
              onChange={(event) => updateField('stock', event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, 2)}
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
            {isSaving ? 'Saving...' : 'Save & Add to Cart'}
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
    zIndex: 95,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
    display: 'grid',
    placeItems: 'center',
    padding: '24px'
  },
  modal: {
    width: '100%',
    maxWidth: '720px',
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
    backgroundColor: '#fff7ed',
    color: '#c2410c',
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
    border: '1px solid rgba(22, 48, 43, 0.12)',
    backgroundColor: '#eff6f3',
    fontSize: '15px',
    fontWeight: 700,
    color: '#17312d',
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
