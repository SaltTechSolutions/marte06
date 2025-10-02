import type { ReactNode } from 'react';
import clsx from 'clsx';
import './layout.css';

export type AppHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export const AppHeader = ({ title, subtitle, actions, className }: AppHeaderProps) => {
  return (
    <div className={clsx('ui-app-header', className)}>
      <div className="ui-app-header__titles">
        <div className="ui-app-header__title">{title}</div>
        {subtitle && <div className="ui-app-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="ui-app-header__actions">{actions}</div>}
    </div>
  );
};
