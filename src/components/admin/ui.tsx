import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page title row with optional actions on the right */
export function PageHeader({ title, intro, actions }: { title: ReactNode; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[34px] leading-tight text-ink sm:text-[40px]">{title}</h1>
        {intro && <p className="mt-1 max-w-[720px] text-sm text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-stone bg-cream p-5 sm:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-serif text-2xl leading-tight text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warn' }) {
  return (
    <div className="rounded-2xl border border-stone bg-cream px-4 py-4">
      <p className="text-xs uppercase tracking-[0.12em] text-bronze">{label}</p>
      <p className={cn('mt-1.5 text-[28px] font-medium leading-none tracking-tight tabular-nums', tone === 'warn' ? 'text-red-800' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const statusTone: Record<string, string> = {
  held: 'bg-sand text-bronze border-taupe',
  pending_payment: 'bg-amber-50 text-amber-900 border-amber-200',
  confirmed: 'bg-cocoa text-cream border-cocoa',
  completed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  cancelled: 'bg-stone text-muted border-stone',
  no_show: 'bg-red-50 text-red-900 border-red-200',
  expired: 'bg-stone text-muted border-stone',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', statusTone[status] ?? statusTone.held)}>{label}</span>;
}

export const inputClass =
  'h-10 w-full rounded-xl border border-taupe bg-white px-3 text-[15px] text-ink placeholder:text-muted/60 transition focus:border-bronze focus:outline-none focus:ring-2 focus:ring-accent/30';

export const buttonClass = {
  primary: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-cocoa px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink disabled:opacity-50',
  secondary: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-taupe bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-bronze disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm text-muted transition hover:bg-stone/60 hover:text-ink disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-red-900 px-4 py-2 text-sm font-medium text-cream transition hover:bg-red-950 disabled:opacity-50',
};

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-900',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
        tone === 'info' && 'border-stone bg-sand text-ink',
      )}
    >
      {children}
    </p>
  );
}
