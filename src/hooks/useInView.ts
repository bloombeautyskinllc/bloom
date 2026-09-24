import { useEffect, useRef, useState } from 'react';

type Options = { rootMargin?: string; once?: boolean };

// Flips to true the first time the element scrolls into view (or every time, with once: false)
export function useInView<T extends Element = HTMLElement>({ rootMargin = '0px 0px -12% 0px', once = true }: Options = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, once]);

  return [ref, inView] as const;
}
