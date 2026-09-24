import { Children, cloneElement, isValidElement, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';

type SplitTextProps = {
  as?: ElementType;
  /** 'word' rises each word out of a mask; 'char' lifts letter by letter */
  by?: 'word' | 'char';
  delay?: number;
  /** ms between consecutive words/letters */
  stagger?: number;
  className?: string;
  children: ReactNode;
  'aria-hidden'?: boolean;
};

// Recursively wraps every word (or letter) in animated spans, keeping inline elements like <em> intact
function split(node: ReactNode, by: 'word' | 'char', counter: { i: number }): ReactNode {
  if (typeof node === 'string' || typeof node === 'number') {
    const parts = by === 'word' ? String(node).split(/(\s+)/) : Array.from(String(node));
    return parts.map((part, k) =>
      part === '' || /^\s+$/.test(part) ? (
        part
      ) : (
        <span key={k} className="split-word">
          <span className="split-inner" style={{ '--i': counter.i++ } as CSSProperties}>
            {part}
          </span>
        </span>
      ),
    );
  }
  if (Array.isArray(node)) return Children.map(node, (child) => split(child, by, counter));
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return cloneElement(node, undefined, split(node.props.children, by, counter));
  }
  return node;
}

export default function SplitText({ as: Tag = 'span', by = 'word', delay = 0, stagger, className = '', children, ...rest }: SplitTextProps) {
  const [ref, inView] = useInView<HTMLElement>();
  const step = stagger ?? (by === 'word' ? 70 : 60);

  return (
    <Tag
      ref={ref}
      className={`split split--${by} ${inView ? 'is-in' : ''} ${className}`}
      style={{ '--d': `${delay}ms`, '--stagger': `${step}ms` } as CSSProperties}
      {...rest}
    >
      {split(children, by, { i: 0 })}
    </Tag>
  );
}
