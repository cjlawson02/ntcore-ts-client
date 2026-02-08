import type { ReactNode } from 'react';

interface ValueCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function ValueCard({ title, children, className }: ValueCardProps) {
  return (
    <div className={`card ${className ?? ''}`.trim()}>
      <h2>{title}</h2>
      <div className="value">{children}</div>
    </div>
  );
}
