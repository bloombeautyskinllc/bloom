import Lenis from 'lenis';
import { prefersReducedMotion } from './motion';

// Single Lenis instance shared across the app. It drives the native window
// scroll, so existing `scroll` listeners (parallax, progress bar…) keep working.
let lenis: Lenis | null = null;

export function initSmoothScroll() {
  if (lenis || prefersReducedMotion()) return () => {};

  lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 0.9,
    anchors: false, // hash links are handled by ScrollManager
  });

  let frame = requestAnimationFrame(function raf(time) {
    lenis?.raf(time);
    frame = requestAnimationFrame(raf);
  });

  return () => {
    cancelAnimationFrame(frame);
    lenis?.destroy();
    lenis = null;
  };
}

export function scrollToTarget(target: HTMLElement | number, options: { immediate?: boolean; offset?: number } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.4, ...options });
    return;
  }
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: options.immediate ? 'auto' : 'smooth' });
  } else {
    target.scrollIntoView({ behavior: options.immediate ? 'auto' : 'smooth' });
  }
}

export function setScrollLocked(locked: boolean) {
  if (locked) lenis?.stop();
  else lenis?.start();
}
