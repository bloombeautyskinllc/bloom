'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  /** PNG data URL of the current drawing (null = empty) */
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  clearLabel: string;
  /** Shown faintly in the empty pad, e.g. "Sign here" */
  placeholder?: string;
  /** Drawn under the strokes (not part of the PNG), e.g. a face outline */
  background?: ReactNode;
  /** width / height of the drawing area */
  aspectRatio: number;
  color?: string;
  lineWidth?: number;
  invalid?: boolean;
  className?: string;
};

// Retina is enough; higher densities only make the stored PNG bigger
const MAX_DPR = 2;

/** Finger, pen or mouse drawing exported as a transparent PNG. Used for signatures and face maps. */
export default function DrawingPad({ value, onChange, label, clearLabel, placeholder, background, aspectRatio, color = '#231B15', lineWidth = 2.4, invalid, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  // Repaints the saved drawing (after a resize, or when the pad mounts again)
  const paint = useCallback((src: string | null) => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!src) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
    img.src = src;
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = Math.round(c.clientWidth * dpr);
      const height = Math.round(c.clientHeight * dpr);
      if (width === c.width && height === c.height) return;
      c.width = width;
      c.height = height;
      paint(latest.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    return () => observer.disconnect();
  }, [paint]);

  // Cleared from outside (e.g. "Clear" or a reset)
  useEffect(() => {
    if (value === null) paint(null);
  }, [value, paint]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const scale = c.width / c.clientWidth;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = null;
    if (dirty.current) onChange(canvas.current!.toDataURL('image/png'));
    dirty.current = false;
  };

  return (
    <div className={className}>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-white transition',
          invalid ? 'border-accent ring-2 ring-accent/20' : 'border-taupe focus-within:border-bronze',
        )}
        style={{ aspectRatio }}
      >
        {background && <div className="pointer-events-none absolute inset-0">{background}</div>}
        {!value && placeholder && (
          <span className="pointer-events-none absolute inset-x-0 bottom-[22%] mx-6 select-none border-b border-dashed border-taupe pb-1 text-left text-xs uppercase tracking-[0.2em] text-muted/70">
            {placeholder}
          </span>
        )}
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          // Drawing must not scroll or zoom the page on touch screens
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            drawing.current = p;
            // A tap leaves a dot
            stroke(p, { x: p.x + 0.1, y: p.y + 0.1 });
            dirty.current = true;
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            // Coalesced events keep fast strokes smooth on phones
            const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
            for (const ev of events) {
              const rect = canvas.current!.getBoundingClientRect();
              const p = { x: ((ev.clientX - rect.left) / rect.width) * canvas.current!.width, y: ((ev.clientY - rect.top) / rect.height) * canvas.current!.height };
              stroke(drawing.current, p);
              drawing.current = p;
            }
            dirty.current = true;
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => {
            paint(null);
            onChange(null);
          }}
          disabled={!value}
          className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-sand hover:text-ink disabled:opacity-40"
        >
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
