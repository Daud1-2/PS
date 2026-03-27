import React, { useEffect, useMemo, useRef, useState } from 'react';

export function createProductDraft(initialValues = {}, options = {}) {
  const defaultStock =
    options.defaultStock !== undefined ? String(options.defaultStock) : '0';

  return {
    name: String(initialValues.name || '').trim(),
    barcode: String(initialValues.barcode || '').trim(),
    sellingPrice:
      initialValues.sellingPrice !== undefined &&
      initialValues.sellingPrice !== null
        ? String(initialValues.sellingPrice)
        : '',
    costPrice:
      initialValues.costPrice !== undefined && initialValues.costPrice !== null
        ? String(initialValues.costPrice)
        : '',
    stock:
      initialValues.stock !== undefined && initialValues.stock !== null
        ? String(initialValues.stock)
        : defaultStock
  };
}

export function validateProductDraft(draft) {
  const errors = {};
  const payload = {
    name: String(draft?.name || '').trim(),
    barcode: String(draft?.barcode || '').trim(),
    sellingPrice: Number(draft?.sellingPrice),
    costPrice: Number(draft?.costPrice),
    stock: Number.parseInt(String(draft?.stock || '').trim(), 10)
  };

  if (!payload.name) {
    errors.name = 'Product name is required.';
  }

  if (!payload.barcode) {
    errors.barcode = 'Barcode is required.';
  }

  if (!Number.isFinite(payload.sellingPrice)) {
    errors.sellingPrice = 'Selling price must be numeric.';
  }

  if (!Number.isFinite(payload.costPrice)) {
    errors.costPrice = 'Cost price must be numeric.';
  }

  if (!Number.isInteger(payload.stock) || payload.stock < 0) {
    errors.stock = 'Stock must be a whole number.';
  }

  return {
    errors,
    payload: Object.keys(errors).length === 0 ? payload : null
  };
}

function ModalShell({ children }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>{children}</div>
    </div>
  );
}

export default function ProductForm({
  isOpen,
  mode = 'create',
  title,
  initialValues,
  submitLabel,
  onSubmit,
  onClose
}) {
  const [draft, setDraft] = useState(createProductDraft(initialValues, { defaultStock: 1 }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const nameRef = useRef(null);
  const barcodeRef = useRef(null);
  const sellingPriceRef = useRef(null);
  const costPriceRef = useRef(null);
  const stockRef = useRef(null);

  const fieldRefs = useMemo(
    () => [nameRef, barcodeRef, sellingPriceRef, costPriceRef, stockRef],
    []
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(createProductDraft(initialValues, { defaultStock: 1 }));
    setErrors({});
    setFormError('');
    setIsSaving(false);

    window.requestAnimationFrame(() => {
      nameRef.current?.focus();
      nameRef.current?.select?.();
    });
  }, [isOpen, initialValues]);

  if (!isOpen) {
    return null;
  }

  const heading =
    title || (mode === 'edit' ? 'Edit product details' : 'Add product');
  const buttonLabel =
    submitLabel || (mode === 'edit' ? 'Save changes' : 'Save product');

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

  const handleFieldKeyDown = (event, index) => {
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
      await onSubmit?.(validation.payload);
    } catch (error) {
      setFormError(error?.message || 'Unable to save product.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Products</div>
          <h2 style={styles.title}>{heading}</h2>
        </div>

        <button type="button" onClick={onClose} style={styles.closeButton}>
          Close
        </button>
      </div>

      <div style={styles.formGrid}>
        <label style={styles.field}>
          <span style={styles.label}>Product Name</span>
          <input
            ref={nameRef}
            type="text"
            value={draft.name}
            onChange={(event) => updateField('name', event.target.value)}
            onKeyDown={(event) => handleFieldKeyDown(event, 0)}
            style={styles.input}
          />
          {errors.name ? <span style={styles.error}>{errors.name}</span> : null}
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Barcode</span>
          <input
            ref={barcodeRef}
            type="text"
            value={draft.barcode}
            onChange={(event) => updateField('barcode', event.target.value)}
            onKeyDown={(event) => handleFieldKeyDown(event, 1)}
            style={styles.input}
          />
          {errors.barcode ? (
            <span style={styles.error}>{errors.barcode}</span>
          ) : null}
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Selling Price</span>
          <input
            ref={sellingPriceRef}
            type="number"
            step="0.01"
            value={draft.sellingPrice}
            onChange={(event) => updateField('sellingPrice', event.target.value)}
            onKeyDown={(event) => handleFieldKeyDown(event, 2)}
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
            onKeyDown={(event) => handleFieldKeyDown(event, 3)}
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
            onKeyDown={(event) => handleFieldKeyDown(event, 4)}
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
          {isSaving ? 'Saving...' : buttonLabel}
        </button>
      </div>
    </ModalShell>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    backgroundColor: 'rgba(15, 23, 42, 0.44)',
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
    color: '#2457c5'
  },
  title: {
    margin: '8px 0 0',
    fontSize: '26px',
    lineHeight: 1.15,
    color: '#101828'
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
  formGrid: {
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
    minHeight: '48px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(15, 23, 42, 0.12)',
    backgroundColor: '#f8fafc',
    fontSize: '15px',
    color: '#111827',
    boxSizing: 'border-box',
    outline: 'none'
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
