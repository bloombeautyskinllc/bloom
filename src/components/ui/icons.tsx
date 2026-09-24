import type { IconBaseProps } from 'react-icons';

// Custom line icons for the treatment pages, drawn to match the Phosphor "light" set

export function BrowLipsIcon({ className, ...props }: IconBaseProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={12}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      className={className}
      {...props}
    >
      <path d="M40 116c52-50 124-56 184-24" />
      <path d="M72 172c20-14 38-16 56-2 18-14 36-12 56 2-18 22-38 30-56 30s-38-8-56-30Z" />
    </svg>
  );
}
