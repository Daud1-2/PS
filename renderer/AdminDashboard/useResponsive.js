import { useEffect, useState } from 'react';

function getViewportWidth() {
  if (typeof window === 'undefined') {
    return 1280;
  }

  return window.innerWidth || 1280;
}

export default function useResponsive() {
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(getViewportWidth());
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    viewportWidth,
    isTablet: viewportWidth <= 1024,
    isMobile: viewportWidth <= 720
  };
}
