import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';

const ManualSearch = forwardRef(function ManualSearch(
  { onProductSelected, onSearchMiss, onReturnFocus },
  ref
) {
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const blurTimeoutRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus();
    },
    clear() {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setShowResults(false);
    }
  }));

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setActiveIndex(0);
      setIsSearching(false);
      return undefined;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setIsSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        let nextResults = await window.posAPI.searchProducts(trimmedQuery);

        if (nextResults.length === 0) {
          try {
            await window.posAPI.refreshProducts();
            nextResults = await window.posAPI.searchProducts(trimmedQuery);
          } catch (refreshError) {
            console.error(
              'Manual search refresh failed after no local results:',
              refreshError
            );
          }
        }

        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setResults(nextResults);
        setActiveIndex(0);
        setShowResults(true);
      } catch (error) {
        console.error('Manual product search failed:', error);

        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        setResults([]);
        setShowResults(true);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false);
        }
      }
    }, 90);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setActiveIndex(0);
    setShowResults(false);
  };

  const handleSelect = (product) => {
    onProductSelected?.(product, query.trim());
    resetSearch();
    onReturnFocus?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setShowResults(true);
      setActiveIndex((currentIndex) => (currentIndex + 1) % results.length);
      return;
    }

    if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setShowResults(true);
      setActiveIndex((currentIndex) =>
        currentIndex === 0 ? results.length - 1 : currentIndex - 1
      );
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (results[activeIndex]) {
      handleSelect(results[activeIndex]);
      return;
    }

    onSearchMiss?.(query.trim());
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      setShowResults(false);
    }, 120);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }

    if (query.trim()) {
      setShowResults(true);
    }
  };

  return (
    <div style={styles.wrapper}>
      <label htmlFor="manual-search-input" style={styles.label}>
        Manual search
      </label>
      <div style={styles.fieldShell}>
        <input
          id="manual-search-input"
          ref={inputRef}
          type="text"
          value={query}
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => {
            setQuery(event.target.value);
            setShowResults(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search name or barcode"
          style={styles.input}
        />

        {showResults && query.trim() ? (
          <div style={styles.resultsPanel}>
            {isSearching ? (
              <div style={styles.statusRow}>Searching products...</div>
            ) : null}

            {!isSearching && results.length === 0 ? (
              <div style={styles.statusRow}>No products found</div>
            ) : null}

            {!isSearching &&
              results.map((product, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(product)}
                    style={{
                      ...styles.resultButton,
                      ...(isActive ? styles.activeResultButton : {})
                    }}
                  >
                    <span style={styles.resultName}>{product.name}</span>
                    <span style={styles.resultMeta}>
                      {product.barcode} | ${Number(product.sellingPrice).toFixed(2)} |{' '}
                      Stock {product.stock}
                    </span>
                  </button>
                );
              })}
          </div>
        ) : null}
      </div>
      <div style={styles.hint}>Arrow keys navigate, Enter adds selected product</div>
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
  fieldShell: {
    position: 'relative'
  },
  input: {
    width: '100%',
    minHeight: '70px',
    padding: '16px 18px',
    borderRadius: '14px',
    border: '1px solid rgba(31, 41, 55, 0.16)',
    backgroundColor: '#fbfcfe',
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.2,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 2px rgba(16, 24, 40, 0.04)'
  },
  resultsPanel: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    zIndex: 10,
    display: 'grid',
    gap: '6px',
    padding: '10px',
    borderRadius: '14px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 20px 40px rgba(16, 24, 40, 0.12)',
    maxHeight: '360px',
    overflowY: 'auto'
  },
  statusRow: {
    padding: '12px 14px',
    borderRadius: '12px',
    backgroundColor: '#f8fafc',
    fontSize: '14px',
    color: '#667085'
  },
  resultButton: {
    display: 'grid',
    gap: '4px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid transparent',
    backgroundColor: '#ffffff',
    textAlign: 'left',
    cursor: 'pointer'
  },
  activeResultButton: {
    backgroundColor: '#eef6ff',
    borderColor: 'rgba(47, 111, 237, 0.18)'
  },
  resultName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827'
  },
  resultMeta: {
    fontSize: '12px',
    color: '#667085'
  },
  hint: {
    fontSize: '12px',
    color: '#667085'
  }
};

export default ManualSearch;
