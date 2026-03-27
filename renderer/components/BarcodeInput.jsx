import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';

const AUTO_SUBMIT_IDLE_MS = 70;
const FAST_INPUT_GAP_MS = 45;
const MIN_AUTO_SUBMIT_LENGTH = 6;

function focusWithoutScroll(element) {
  if (!element) {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch (_error) {
    element.focus();
  }
}

const BarcodeInput = forwardRef(function BarcodeInput(
  { onProductScanned, onScanMiss, onQuickAddRequested },
  ref
) {
  const inputRef = useRef(null);
  const autoSubmitTimeoutRef = useRef(null);
  const lastInputAtRef = useRef(0);
  const fastBurstCountRef = useRef(0);
  const [barcode, setBarcode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [missingBarcode, setMissingBarcode] = useState('');

  useImperativeHandle(ref, () => ({
    focus() {
      focusWithoutScroll(inputRef.current);
    },
    clearMissState() {
      setMissingBarcode('');
    }
  }));

  useEffect(() => {
    focusWithoutScroll(inputRef.current);

    return () => {
      if (autoSubmitTimeoutRef.current) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, []);

  const clearAutoSubmitTimeout = () => {
    if (!autoSubmitTimeoutRef.current) {
      return;
    }

    window.clearTimeout(autoSubmitTimeoutRef.current);
    autoSubmitTimeoutRef.current = null;
  };

  const handleSubmit = async (value = barcode) => {
    const normalizedBarcode = String(value || '').trim();
    let shouldRefocusScanner = true;

    clearAutoSubmitTimeout();

    if (!normalizedBarcode || isLookingUp) {
      focusWithoutScroll(inputRef.current);
      return;
    }

    setIsLookingUp(true);

    try {
      let product = await window.posAPI.getProduct(normalizedBarcode);

      if (!product) {
        try {
          await window.posAPI.refreshProducts();
          product = await window.posAPI.getProduct(normalizedBarcode);
        } catch (refreshError) {
          console.error('Product refresh failed after scan miss:', refreshError);
        }
      }

      if (product) {
        setMissingBarcode('');
        shouldRefocusScanner = onProductScanned?.(product, normalizedBarcode) !== false;
      } else {
        setMissingBarcode(normalizedBarcode);
        onScanMiss?.(normalizedBarcode);
      }
    } catch (error) {
      console.error('Product lookup failed:', error);
      setMissingBarcode('');
      onScanMiss?.(normalizedBarcode, error);
    } finally {
      setBarcode('');
      setIsLookingUp(false);
      fastBurstCountRef.current = 0;
      lastInputAtRef.current = 0;

      if (shouldRefocusScanner) {
        window.requestAnimationFrame(() => {
          focusWithoutScroll(inputRef.current);
        });
      }
    }
  };

  const handleBarcodeChange = (nextValue) => {
    const now = window.performance?.now?.() ?? Date.now();
    const previousInputAt = lastInputAtRef.current;
    const inputGap = previousInputAt ? now - previousInputAt : 0;

    if (previousInputAt && inputGap <= FAST_INPUT_GAP_MS) {
      fastBurstCountRef.current += 1;
    } else {
      fastBurstCountRef.current = 1;
    }

    lastInputAtRef.current = now;
    setBarcode(nextValue);
    clearAutoSubmitTimeout();

    if (missingBarcode) {
      setMissingBarcode('');
    }

    const trimmedValue = String(nextValue || '').trim();
    const looksLikeScannerInput =
      trimmedValue.length >= MIN_AUTO_SUBMIT_LENGTH && fastBurstCountRef.current >= 4;

    if (!looksLikeScannerInput || isLookingUp) {
      return;
    }

    autoSubmitTimeoutRef.current = window.setTimeout(() => {
      autoSubmitTimeoutRef.current = null;
      void handleSubmit(trimmedValue);
    }, AUTO_SUBMIT_IDLE_MS);
  };

  return (
    <section style={styles.shell}>
      <div style={styles.searchBar}>
        <div style={styles.searchIcon}>S</div>

        <div style={styles.inputWrap}>
          <div style={styles.label}>Search Products</div>
          <input
            id="barcode-input"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck="false"
            value={barcode}
            onChange={(event) => {
              handleBarcodeChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Scan or type barcode, then press Enter"
            style={styles.input}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={isLookingUp}
          style={{
            ...styles.enterButton,
            ...(isLookingUp ? styles.enterButtonDisabled : {})
          }}
        >
          {isLookingUp ? '...' : 'Enter'}
        </button>
      </div>

      <div style={styles.metaRow}>
        <div style={styles.metaText}>
          {isLookingUp
            ? 'Looking up product...'
            : 'Scanner-ready input for fast cashier flow'}
        </div>
        <div style={styles.metaPill}>Auto-add on scan</div>
      </div>

      {missingBarcode ? (
        <div style={styles.missCard}>
          <div style={styles.missTitle}>Product not found</div>
          <div style={styles.missMeta}>Barcode {missingBarcode}</div>
          <button
            type="button"
            onClick={() => onQuickAddRequested?.(missingBarcode)}
            style={styles.quickAddButton}
          >
            Add New Product
          </button>
        </div>
      ) : null}
    </section>
  );
});

const styles = {
  shell: {
    display: 'grid',
    gap: '10px'
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '18px 20px',
    borderRadius: '26px',
    background: 'rgba(255, 255, 255, 0.84)',
    border: '1px solid rgba(22, 48, 43, 0.1)',
    boxShadow: '0 16px 34px rgba(92, 74, 28, 0.08)'
  },
  searchIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17312d',
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 800,
    flexShrink: 0
  },
  inputWrap: {
    display: 'grid',
    gap: '6px',
    flex: 1
  },
  label: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#7c8f88'
  },
  input: {
    width: '100%',
    minHeight: '34px',
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    fontSize: '16px',
    fontWeight: 700,
    color: '#6b7280',
    boxSizing: 'border-box'
  },
  enterButton: {
    minWidth: '88px',
    minHeight: '46px',
    padding: '0 18px',
    border: 'none',
    borderRadius: '16px',
    backgroundColor: '#17312d',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 800,
    cursor: 'pointer',
    flexShrink: 0
  },
  enterButtonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed'
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '0 4px'
  },
  metaText: {
    fontSize: '12px',
    color: '#667d75'
  },
  metaPill: {
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: '#edf4f0',
    color: '#48665d',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  missCard: {
    display: 'grid',
    gap: '6px',
    padding: '14px 16px',
    borderRadius: '16px',
    backgroundColor: '#fff3f5',
    border: '1px solid rgba(225, 29, 72, 0.14)'
  },
  missTitle: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#be123c'
  },
  missMeta: {
    fontSize: '12px',
    color: '#9f1239'
  },
  quickAddButton: {
    justifySelf: 'start',
    minHeight: '38px',
    padding: '0 12px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#be123c',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  }
};

export default BarcodeInput;
