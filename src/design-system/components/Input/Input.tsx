// src/design-system/components/Input/Input.tsx
import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import './Input.css';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    hint?: string;
    error?: string;
    size?: 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
    label,
    hint,
    error,
    size = 'md',
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    id,
    required,
    disabled,
    ...props
}, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
        <div className={clsx('ds-input-wrapper', { 'ds-input-wrapper--full': fullWidth }, className)}>
            {label && (
                <label htmlFor={inputId} className="ds-input-label">
                    {label}
                    {required && <span className="ds-input-required" aria-hidden="true">*</span>}
                </label>
            )}

            <div className={clsx(
                'ds-input-container',
                `ds-input-container--${size}`,
                {
                    'ds-input-container--error': !!error,
                    'ds-input-container--disabled': disabled,
                    'ds-input-container--has-left': !!leftIcon,
                    'ds-input-container--has-right': !!rightIcon,
                }
            )}>
                {leftIcon && <span className="ds-input-icon ds-input-icon--left">{leftIcon}</span>}
                <input
                    ref={ref}
                    id={inputId}
                    className="ds-input"
                    disabled={disabled}
                    required={required}
                    aria-invalid={!!error}
                    aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
                    {...props}
                />
                {rightIcon && <span className="ds-input-icon ds-input-icon--right">{rightIcon}</span>}
            </div>

            {hint && !error && (
                <span id={hintId} className="ds-input-hint">{hint}</span>
            )}

            {error && (
                <span id={errorId} className="ds-input-error" role="alert">{error}</span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
