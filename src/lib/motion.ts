export const easeLux = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
