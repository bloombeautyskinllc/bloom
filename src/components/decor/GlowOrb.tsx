// Warm, blurred pool of light that drifts slowly behind a section's content.
// Size and position come from className; color is any CSS color.
export default function GlowOrb({ className = '', color = 'rgba(217, 199, 181, 0.55)', delay = 0 }: { className?: string; color?: string; delay?: number }) {
  return (
    <span
      aria-hidden
      className={`decor-motion pointer-events-none absolute -z-10 animate-drift rounded-full ${className}`}
      style={{ backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 68%)`, animationDelay: `${delay}s` }}
    />
  );
}
