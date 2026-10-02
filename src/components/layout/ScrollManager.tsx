'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initSmoothScroll, scrollToTarget } from '../../lib/smoothScroll';

function scrollToHash(hash: string) {
  const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (el) scrollToTarget(el);
  return el !== null;
}

// Lenis drives the scroll, so "#section" targets are scrolled here instead of natively:
// same-page "/#about"-style links are intercepted, other pages reset to the top (or their hash).
export default function ScrollManager() {
  const pathname = usePathname();

  useEffect(() => initSmoothScroll(), []);

  useEffect(() => {
    if (!scrollToHash(window.location.hash)) scrollToTarget(0, { immediate: true });
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest('a');
      if (!anchor || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
      if (!document.getElementById(decodeURIComponent(url.hash.slice(1)))) return;
      // Handled before Next's router sees it, like React Router's hash links were
      e.preventDefault();
      e.stopPropagation();
      window.history.pushState(window.history.state, '', url.hash);
      scrollToHash(url.hash);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
