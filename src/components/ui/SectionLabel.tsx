import { useInView } from '../../hooks/useInView';

type SectionLabelProps = {
  children: React.ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
  delay?: number;
  /** 'both' adds a matching hairline before the dot, for centered headers */
  lines?: 'end' | 'both';
};

const ease = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

// Eyebrow label: the dot pops in, the text slides in and a hairline draws out after it
export default function SectionLabel({ children, tone = 'dark', className = '', delay = 0, lines = 'end' }: SectionLabelProps) {
  const color = tone === 'dark' ? 'text-bronze' : 'text-sand';
  const [ref, inView] = useInView<HTMLParagraphElement>();

  const hairline = (origin: string) => (
    <span
      aria-hidden
      style={{ transitionDelay: `${delay + 450}ms` }}
      className={`h-px w-10 ${origin} bg-current opacity-40 transition-transform duration-[1400ms] ${ease} ${inView ? 'scale-x-100' : 'scale-x-0'}`}
    />
  );

  return (
    <p
      ref={ref}
      className={`flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] sm:text-xs ${color} ${className}`}
    >
      {lines === 'both' && hairline('origin-right')}
      <span className="relative h-1.5 w-1.5 shrink-0" aria-hidden>
        <span
          style={{ transitionDelay: `${delay}ms` }}
          className={`absolute inset-0 rounded-full bg-current transition-transform duration-700 ${ease} ${inView ? 'scale-100' : 'scale-0'}`}
        />
        {inView && <span className="decor-motion absolute inset-0 animate-pulse-ring rounded-full bg-current [animation-iteration-count:2]" />}
      </span>
      <span
        style={{ transitionDelay: `${delay + 150}ms` }}
        className={`transition-[opacity,transform] duration-1000 ${ease} ${inView ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'}`}
      >
        {children}
      </span>
      {hairline('origin-left')}
    </p>
  );
}
