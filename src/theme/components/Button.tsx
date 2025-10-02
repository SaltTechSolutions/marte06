import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import './primitives.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonTone = 'solid' | 'soft' | 'outline';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const Button = ({
  children,
  icon,
  variant = 'primary',
  tone = 'solid',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
  disabled,
  ...rest
}: ButtonProps) => {
  const classes = clsx(
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${tone}`,
    `ui-button--${size}`,
    {
      'ui-button--full': fullWidth,
      'ui-button--loading': loading,
    },
    className,
  );

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      <span className="ui-button__content">
        {loading && <span className="ui-button__spinner" aria-hidden>⏳</span>}
        {icon && <span className="ui-button__icon">{icon}</span>}
        <span className="ui-button__label">{children}</span>
      </span>
    </button>
  );
};

export default Button;
