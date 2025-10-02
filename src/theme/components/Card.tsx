import type { ReactNode, HTMLAttributes } from 'react';
import clsx from 'clsx';
import './primitives.css';

export type CardTone = 'default' | 'subtle' | 'strong' | 'highlight';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: CardTone;
  padding?: CardPadding;
  elevation?: 'soft' | 'medium' | 'hard';
  interactive?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

const paddingMap: Record<CardPadding, string> = {
  none: '0',
  sm: 'var(--space-sm, 12px)',
  md: 'var(--space-md, 18px)',
  lg: 'var(--space-lg, 28px)',
};

const Card = ({
  children,
  tone = 'default',
  padding = 'md',
  elevation = 'soft',
  interactive = false,
  header,
  footer,
  className,
  ...rest
}: CardProps) => {
  return (
    <div
      className={clsx(
        'ui-card',
        `ui-card--${tone}`,
        `ui-card--${elevation}`,
        {
          'ui-card--interactive': interactive,
        },
        className,
      )}
      style={{ padding: paddingMap[padding] }}
      {...rest}
    >
      {header && <div className="ui-card__header">{header}</div>}
      <div className="ui-card__body">{children}</div>
      {footer && <div className="ui-card__footer">{footer}</div>}
    </div>
  );
};

export default Card;
