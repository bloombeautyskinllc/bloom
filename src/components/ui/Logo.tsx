import logoMark from '../../assets/images/logo-mark.png';

type LogoProps = {
  tone?: 'light' | 'dark';
  className?: string;
};

export default function Logo({ tone = 'light', className = '' }: LogoProps) {
  const text = tone === 'light' ? 'text-cream' : 'text-ink';

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src={logoMark}
        alt=""
        aria-hidden
        className={`h-[34px] w-auto ${tone === 'dark' ? 'brightness-0 opacity-90' : ''}`}
      />
      <span className={`flex flex-col items-center leading-none ${text}`}>
        <span className="font-serif text-[22px] font-medium tracking-[0.32em] pl-[0.32em]">BLOOM</span>
        <span className="mt-1 text-[7.5px] font-normal tracking-[0.12em] pl-[0.12em]">BEAUTY SKIN</span>
      </span>
      <span className="sr-only">BLOOM Beauty Skin</span>
    </span>
  );
}
