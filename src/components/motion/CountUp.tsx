import { useEffect, useState } from 'react';
import { useInView } from '../../hooks/useInView';
import { prefersReducedMotion } from '../../lib/motion';

// Counts the numeric part of values like "1,200+", "+500" or "4.9/5" up from zero when scrolled into view
export default function CountUp({ value, duration = 2200, className = '' }: { value: string; duration?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ rootMargin: '0px' });
  const match = value.match(/^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setProgress(t < 1 ? 1 - Math.pow(2, -10 * t) : 1); // ease-out expo
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, duration]);

  if (!match) return <span className={className}>{value}</span>;

  const [, prefix, number, suffix] = match;
  const decimals = number.split('.')[1]?.length ?? 0;
  const target = parseFloat(number.replace(/,/g, ''));
  const current = (target * progress).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: number.includes(','),
  });

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>
        {prefix}
        {current}
        {suffix}
      </span>
    </span>
  );
}
