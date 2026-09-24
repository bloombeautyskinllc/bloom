import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/**
 * Drifts the element vertically as the page scrolls, via the --parallax custom property
 * (pair it with the .parallax class). The parent is measured so the transform never feeds back.
 * anchor 'top' starts at 0 at the top of the page (heroes); 'center' is 0 mid-viewport.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(speed = 0.12, anchor: 'top' | 'center' = 'center') {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const target = el.parentElement ?? el;
    let frame = 0;

    const update = () => {
      frame = 0;
      const r = target.getBoundingClientRect();
      if (r.bottom < -100 || r.top > window.innerHeight + 100) return;
      const offset = anchor === 'top' ? r.top : r.top + r.height / 2 - window.innerHeight / 2;
      el.style.setProperty('--parallax', `${(-offset * speed).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [speed, anchor]);

  return ref;
}
