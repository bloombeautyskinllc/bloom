'use client';

import type { ReactNode } from 'react';
import { useParallax } from '../../hooks/useParallax';

type ParallaxProps = {
  speed?: number;
  anchor?: 'top' | 'center';
  className?: string;
  children: ReactNode;
};

// Client island around useParallax, so the sections that use it can stay server components
export default function Parallax({ speed, anchor, className = '', children }: ParallaxProps) {
  const ref = useParallax<HTMLDivElement>(speed, anchor);

  return (
    <div ref={ref} className={`parallax ${className}`}>
      {children}
    </div>
  );
}
