import Reveal from './Reveal';
import { useParallax } from '../../hooks/useParallax';

type ParallaxImageProps = {
  src: string;
  alt: string;
  /** Sizing and rounding of the frame, e.g. "h-[480px] rounded-[22px]" */
  className?: string;
  imgClassName?: string;
  speed?: number;
  delay?: number;
};

// Photo unveiled with a curtain wipe, then drifting slowly inside its frame on scroll
export default function ParallaxImage({ src, alt, className = '', imgClassName = '', speed = 0.08, delay = 0 }: ParallaxImageProps) {
  const ref = useParallax<HTMLDivElement>(speed);

  return (
    <Reveal variant="wipe" delay={delay} className={`relative isolate overflow-hidden ${className}`}>
      <div ref={ref} className="parallax absolute inset-x-0 -inset-y-[9%]">
        <img src={src} alt={alt} loading="lazy" className={`reveal-zoom h-full w-full object-cover ${imgClassName}`} />
      </div>
    </Reveal>
  );
}
