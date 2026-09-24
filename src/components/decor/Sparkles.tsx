import type { CSSProperties } from 'react';

export type Sparkle = {
  /** CSS position inside the (relative) parent, e.g. '12%' */
  top: string;
  left: string;
  /** px */
  size?: number;
  /** s, offsets the twinkle so the sparkles never blink in unison */
  delay?: number;
};

// Four-point star, the brand's ✦ drawn as a crisp vector
export function SparkleIcon({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden fill="currentColor">
      <path d="M12 0c.6 7 4.9 11.4 12 12-7.1.6-11.4 4.9-12 12-.6-7.1-4.9-11.4-12-12C7.1 11.4 11.4 7 12 0Z" />
    </svg>
  );
}

// A scatter of softly twinkling stars; color comes from the text color of className
export default function Sparkles({ items, className = '' }: { items: Sparkle[]; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {items.map(({ top, left, size = 12, delay = 0 }, i) => (
        <SparkleIcon
          key={i}
          className="decor-motion absolute animate-twinkle"
          style={{ top, left, width: size, height: size, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
