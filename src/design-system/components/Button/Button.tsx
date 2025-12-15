// src/design-system/components/Button/Button.tsx
import React from 'react';
import { clsx } from 'clsx';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    ...props
}) => {
    return (
        <button
            className={clsx(
                'ds-btn',
                `ds-btn--${variant}`,
                `ds-btn--${size}`,
                {
                    'ds-btn--loading': loading,
                    'ds-btn--full': fullWidth,
                },
                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <span className="ds-btn__spinner" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                </span>
            )}
            {!loading && leftIcon && <span className="ds-btn__icon ds-btn__icon--left">{leftIcon}</span>}
            <span className="ds-btn__label">{children}</span>
            {!loading && rightIcon && <span className="ds-btn__icon ds-btn__icon--right">{rightIcon}</span>}
        </button>
    );
};

export default Button;
