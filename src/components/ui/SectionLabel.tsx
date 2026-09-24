type SectionLabelProps = {
  children: React.ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
};

export default function SectionLabel({ children, tone = 'dark', className = '' }: SectionLabelProps) {
  const color = tone === 'dark' ? 'text-bronze' : 'text-sand';

  return (
    <p className={`flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] sm:text-xs ${color} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </p>
  );
}
