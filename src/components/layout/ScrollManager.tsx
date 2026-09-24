import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initSmoothScroll, scrollToTarget } from '../../lib/smoothScroll';

// React Router does not scroll to #hash targets on its own: handle both
// "/#about"-style links and resetting to the top on page changes.
export default function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => initSmoothScroll(), []);

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        scrollToTarget(el);
        return;
      }
    }
    scrollToTarget(0, { immediate: true });
  }, [pathname, hash]);

  return null;
}
