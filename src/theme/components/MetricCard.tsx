import type { ReactNode } from 'react';
import clsx from 'clsx';
import './primitives.css';
import Tag from './Tag';

export type MetricTone = 'primary' | 'success' | 'warning' | 'info';
export type MetricDeltaTone = 'success' | 'danger' | 'warning';

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  tone?: MetricTone;
  loading?: boolean;
  deltaLabel?: string;
  deltaTone?: MetricDeltaTone;
}

const MetricCard = ({
  title,
  value,
  icon,
  subtitle,
  tone = 'primary',
  loading = false,
  deltaLabel,
  deltaTone = 'success',
}: MetricCardProps) => {
  if (loading) {
    return (
      <div className={clsx('ui-card', 'ui-metric', `ui-metric--${tone}`, 'ui-metric--loading')} aria-live="polite">
        <div className="ui-metric__header">
          <div className="ui-metric__icon-skeleton" />
          <div className="ui-metric__title-skeleton" />
        </div>
        <div className="ui-metric__value-skeleton" />
        <div className="ui-metric__subtitle-skeleton" />
      </div>
    );
  }

  return (
    <div className={clsx('ui-card', 'ui-metric', `ui-metric--${tone}`)}>
      <div className="ui-metric__header">
        <div className={clsx('ui-metric__icon', `ui-metric__icon--${tone}`)} aria-hidden>
          {icon}
        </div>
        <div className="ui-metric__meta">
          <span className="ui-metric__title">{title}</span>
          {subtitle && <span className="ui-metric__subtitle">{subtitle}</span>}
        </div>
      </div>

      <span className="ui-metric__value">{value}</span>

      {deltaLabel && (
        <Tag
          tone={deltaTone === 'warning' ? 'warning' : deltaTone === 'danger' ? 'danger' : 'success'}
          className="ui-metric__delta"
        >
          {deltaLabel}
        </Tag>
      )}
    </div>
  );
};

export default MetricCard;
