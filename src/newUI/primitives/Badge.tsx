import type { ReactNode } from 'react';
import clsx from 'clsx';
import './feedback.css';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export type BadgeProps = {
  children: ReactNode;
  icon?: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export const Badge = ({ children, icon, variant = 'neutral', className }: BadgeProps) => {
  return (
    <span className={clsx('ui-badge', className)} data-variant={variant}>
      {icon && <span className="ui-badge__icon" aria-hidden>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
