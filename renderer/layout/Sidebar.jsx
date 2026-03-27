import React from 'react';

const navItems = [
  {
    id: 'pos',
    label: 'POS',
    icon: <ReceiptIcon />
  },
  {
    id: 'products',
    label: 'Products',
    icon: <GridIcon />
  }
];

export default function Sidebar({ activeView, onNavigate }) {
  return (
    <aside style={styles.rail}>
      <button
        type="button"
        style={styles.menuButton}
        aria-label="Navigation menu"
        title="Navigation menu"
      >
        <MenuIcon />
      </button>

      <div style={styles.brandMark}>G</div>

      <nav style={styles.nav}>
        {navItems.map((item) => {
          const isActive = item.id === activeView;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              style={{
                ...styles.navButton,
                ...(isActive ? styles.navButtonActive : {})
              }}
              aria-label={item.label}
              title={item.label}
            >
              {isActive ? <span style={styles.activeEdge} /> : null}
              <span style={styles.navIcon}>{item.icon}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 6.5H18M4 11H18M4 15.5H18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M7 4.5H15C16.3807 4.5 17.5 5.61929 17.5 7V17.5L15.4 16.3L13.3 17.5L11.2 16.3L9.1 17.5L7 16.3V7C7 5.61929 8.11929 4.5 9.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.25 8.25H14.75M9.25 11.25H14.75M9.25 14.25H12.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M5.5 5.5H9V9H5.5V5.5ZM13 5.5H16.5V9H13V5.5ZM5.5 13H9V16.5H5.5V13ZM13 13H16.5V16.5H13V13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const styles = {
  rail: {
    width: '76px',
    height: '100vh',
    padding: '18px 8px',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #121c34 0%, #10182d 100%)',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    flexShrink: 0
  },
  menuButton: {
    width: '44px',
    height: '44px',
    border: 'none',
    borderRadius: '18px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#e7eef8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandMark: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    background: 'linear-gradient(180deg, #17345a 0%, #1c486f 100%)',
    color: '#d8e9ff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 900,
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  },
  nav: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    marginTop: '6px'
  },
  navButton: {
    position: 'relative',
    width: '44px',
    height: '44px',
    border: 'none',
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#d7dfec',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 160ms ease, width 160ms ease, color 160ms ease'
  },
  navButtonActive: {
    width: '58px',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    color: '#ffffff'
  },
  activeEdge: {
    position: 'absolute',
    left: 0,
    top: '8px',
    bottom: '8px',
    width: '4px',
    borderRadius: '0 999px 999px 0',
    backgroundColor: '#33c8ff'
  },
  navIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};
