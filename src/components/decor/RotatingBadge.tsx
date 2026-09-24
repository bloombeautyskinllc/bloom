import { useId } from 'react';
import logoMark from '../../assets/images/logo-mark.png';

type RotatingBadgeProps = {
  tone?: 'light' | 'dark';
  text?: string;
  className?: string;
};

// Circular seal with the brand line slowly turning around the logo mark
export default function RotatingBadge({
  tone = 'light',
  text = 'BLOOM Beauty Skin ✦ Advanced cosmetology ✦ ',
  className = '',
}: RotatingBadgeProps) {
  const pathId = `badge-${useId().replace(/[^\w-]/g, '')}`;
  const disk = tone === 'light' ? 'border-cream/40 bg-cream/10 text-cream backdrop-blur-md' : 'border-bronze/20 bg-cocoa text-sand shadow-soft';

  return (
    <span aria-hidden className={`relative grid h-[128px] w-[128px] place-items-center rounded-full border ${disk} ${className}`}>
      <svg viewBox="0 0 120 120" className="decor-motion absolute inset-0 h-full w-full animate-spin-slow">
        <defs>
          <path id={pathId} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
        </defs>
        <text className="fill-current text-[8.4px] font-medium uppercase" style={{ letterSpacing: '0.2em' }}>
          <textPath href={`#${pathId}`} textLength="282" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      <img src={logoMark} alt="" className="h-7 w-auto" />
    </span>
  );
}
