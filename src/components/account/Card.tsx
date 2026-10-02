import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[22px] border border-stone bg-cream/90 p-6 shadow-soft sm:p-8', className)}>{children}</div>;
}
