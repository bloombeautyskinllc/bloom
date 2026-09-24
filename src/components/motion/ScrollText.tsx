import { useEffect, useRef, type CSSProperties } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

// Paragraph whose words light up one after another as it scrolls through the viewport
export default function ScrollText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.setProperty('--p', '1');
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top enters the lower part of the screen, 1 once the bottom passes the middle
      const p = (vh * 0.85 - r.top) / (vh * 0.3 + r.height);
      el.style.setProperty('--p', Math.min(Math.max(p, 0), 1).toFixed(3));
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
  }, []);

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <span
          key={i}
          className="transition-opacity duration-300"
          style={{ opacity: `clamp(0.18, calc(var(--p, 0) * ${words.length + 2} - ${i}), 1)` } as CSSProperties}
        >
          {word}{' '}
        </span>
      ))}
    </p>
  );
}
