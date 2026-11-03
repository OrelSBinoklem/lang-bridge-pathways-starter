import { useRef } from 'react';
import './grammarTableTitle.css';

/** Minimal wrapper for imported grammar table JSX. */
export default function TableCard({ children, className = '' }) {
  const ref = useRef(null);

  return (
    <article ref={ref} className={`table-card ${className}`.trim()}>
      {children}
    </article>
  );
}

