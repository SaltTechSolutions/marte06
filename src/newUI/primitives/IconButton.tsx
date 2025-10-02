import type { ButtonHTMLAttributes, ForwardedRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';
import './primitives.css';

export type IconButtonVariant = 'primary' | 'neutral' | 'danger';
export type IconButtonTone = 'solid' | 'soft' | 'outline' | 'ghost';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  loading?: boolean;
  variant?: IconButtonVariant;
  tone?: IconButtonTone;
  size?: IconButtonSize;
}

type IconButtonComponent = (
  props: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) => ReactNode;

const IconButtonBase: IconButtonComponent = (
  {
    icon,
    loading = false,
    variant = 'primary',
    tone = 'solid',
    size = 'md',
    disabled,
    className,
    ...rest
  },
  ref,
) => {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      className={clsx('ui-btn', 'ui-icon-btn', className)}
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      data-disabled={isDisabled}
      disabled={isDisabled}
      aria-live={loading ? 'polite' : undefined}
      {...rest}
    >
      {loading && (
        <span className="ui-btn__spinner" aria-hidden>
          <Spinner size="sm" />
        </span>
      )}
      <span className="ui-btn__icon" aria-hidden>
        {icon}
      </span>
    </button>
  );
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(IconButtonBase);
IconButton.displayName = 'IconButton';
