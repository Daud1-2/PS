import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';

const BarcodeInput = forwardRef(function BarcodeInput(
  { onProductScanned, onScanMiss },
  ref
) {
  const inputRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus();
    }
  }));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const normalizedBarcode = barcode.trim();

    if (!normalizedBarcode || isLookingUp) {
      inputRef.current?.focus();
      return;
    }

    setIsLookingUp(true);

    try {
      let product = await window.posAPI.getProduct(normalizedBarcode);

      if (product) {
        onProductScanned?.(product, normalizedBarcode);
      } else {
        try {
          await window.posAPI.refreshProducts();
          product = await window.posAPI.getProduct(normalizedBarcode);
        } catch (refreshError) {
          console.error('Product refresh failed after scan miss:', refreshError);
        }

        if (product) {
          onProductScanned?.(product, normalizedBarcode);
        } else {
          onScanMiss?.(normalizedBarcode);
        }
      }
    } catch (error) {
      console.error('Product lookup failed:', error);
      onScanMiss?.(normalizedBarcode, error);
    } finally {
      setBarcode('');
      setIsLookingUp(false);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const handleKeyDown = async (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    await handleSubmit();
  };

  return (
    <div style={styles.wrapper}>
      <label htmlFor="barcode-input" style={styles.label}>
        Barcode
      </label>
      <input
        id="barcode-input"
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck="false"
        value={barcode}
        onChange={(event) => setBarcode(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scan or type barcode, then press Enter"
        style={styles.input}
      />
      <div style={styles.hint}>{isLookingUp ? 'Looking up product...' : 'Ready for next scan'}</div>
    </div>
  );
});

const styles = {
  wrapper: {
    display: 'grid',
    gap: '8px',
    padding: '16px',
    borderRadius: '18px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 6px 20px rgba(16, 24, 40, 0.05)'
  },
  label: {
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#4a5565'
  },
  input: {
    width: '100%',
    minHeight: '70px',
    padding: '16px 18px',
    borderRadius: '14px',
    border: '1px solid rgba(31, 41, 55, 0.16)',
    backgroundColor: '#fbfcfe',
    fontSize: '20px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    lineHeight: 1.2,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 2px rgba(16, 24, 40, 0.04)'
  },
  hint: {
    fontSize: '12px',
    color: '#667085'
  }
};

export default BarcodeInput;
