// Four-petal blob used as a soft backdrop behind stats and call-outs
export default function Flower({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g className="fill-stone">
        <circle cx="70" cy="70" r="56" />
        <circle cx="130" cy="70" r="56" />
        <circle cx="70" cy="130" r="56" />
        <circle cx="130" cy="130" r="56" />
      </g>
    </svg>
  );
}
