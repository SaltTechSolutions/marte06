import type { ButtonHTMLAttributes, ForwardedRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';
import './primitives.css';

export type ButtonVariant = 'primary' | 'neutral' | 'danger';
export type ButtonTone = 'solid' | 'soft' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  asChild?: boolean;
}

type AsChildProps = ButtonProps & { asChild: true; children: ReactNode };

type ButtonComponent = (
  props: ButtonProps | AsChildProps,
  ref: ForwardedRef<HTMLButtonElement>,
) => ReactNode;

const ButtonBase: ButtonComponent = (
  {
    children,
    icon,
    loading = false,
    fullWidth = false,
    disabled,
    variant = 'primary',
    tone = 'solid',
    size = 'md',
    className,
    ...rest
  },
  ref,
) => {
  const isDisabled = disabled || loading;
  const content = (
    <span className="ui-btn__label" data-has-icon={Boolean(icon)}>
      {icon && <span className="ui-btn__icon" aria-hidden>{icon}</span>}
      {children}
    </span>
  );

  return (
    <button
      ref={ref}
      className={clsx('ui-btn', className)}
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      data-full={fullWidth}
      data-disabled={isDisabled}
      disabled={isDisabled}
      {...rest}
    >
      {loading && (
        <span className="ui-btn__spinner" aria-hidden>
          <Spinner size="sm" />
        </span>
      )}
      {content}
    </button>
  );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(ButtonBase);
Button.displayName = 'Button';
