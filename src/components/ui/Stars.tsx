type StarsProps = { rating?: number; className?: string };

export default function Stars({ rating = 5, className = '' }: StarsProps) {
  return (
    <span className={`tracking-[0.2em] ${className}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
    </span>
  );
}
