import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router does not scroll to #hash targets on its own: handle both
// "/#about"-style links and resetting to the top on page changes.
export default function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  return null;
}
