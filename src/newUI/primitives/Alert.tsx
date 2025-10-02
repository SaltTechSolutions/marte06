import type { ReactNode } from 'react';
import clsx from 'clsx';
import './feedback.css';

export type AlertVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export type AlertProps = {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: AlertVariant;
  className?: string;
  children?: ReactNode;
};

export const Alert = ({
  icon,
  title,
  description,
  actions,
  variant = 'neutral',
  className,
  children,
}: AlertProps) => {
  return (
    <div className={clsx('ui-alert', className)} data-variant={variant} role="alert">
      {(icon || title) && (
        <div className="ui-alert__header">
          {icon && <span className="ui-alert__icon" aria-hidden>{icon}</span>}
          <div>
            {title && <div className="ui-alert__title">{title}</div>}
            {description && <div className="ui-alert__description">{description}</div>}
          </div>
        </div>
      )}
      {children}
      {actions && <div className="ui-alert__actions">{actions}</div>}
    </div>
  );
};
