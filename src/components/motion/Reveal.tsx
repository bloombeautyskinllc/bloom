import type { AllHTMLAttributes, CSSProperties, ElementType, ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';

export type RevealVariant = 'up' | 'down' | 'left' | 'right' | 'fade' | 'blur' | 'scale' | 'curtain' | 'wipe';

type RevealProps = {
  as?: ElementType;
  /** up/down/left/right: slide + fade · blur: soft focus-in · scale: grow in
   *  curtain: the element itself is unveiled bottom-up · wipe: same, but only descendants with .reveal-zoom zoom out */
  variant?: RevealVariant;
  /** ms before the transition starts, handy for staggering siblings */
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  loading?: 'lazy' | 'eager';
} & Omit<AllHTMLAttributes<HTMLElement>, 'as' | 'className' | 'style' | 'children'>;

// Animates its content in the first time it scrolls into view
export default function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  duration,
  className = '',
  style,
  children,
  ...rest
}: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>();

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      className={`reveal ${inView ? 'is-in' : ''} ${className}`}
      style={{ '--d': `${delay}ms`, ...(duration ? { '--dur': `${duration}ms` } : {}), ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}
