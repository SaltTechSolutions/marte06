// src/design-system/components/Select/Select.tsx
// Custom select component

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { FiChevronDown } from 'react-icons/fi';
import './Select.css';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    label?: string;
    hint?: string;
    error?: string;
    size?: 'sm' | 'md' | 'lg';
    options: SelectOption[];
    placeholder?: string;
    fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
    label,
    hint,
    error,
    size = 'md',
    options,
    placeholder,
    fullWidth = false,
    className,
    id,
    required,
    disabled,
    ...props
}, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;

    return (
        <div className={clsx('ds-select-wrapper', { 'ds-select-wrapper--full': fullWidth }, className)}>
            {label && (
                <label htmlFor={selectId} className="ds-select-label">
                    {label}
                    {required && <span className="ds-select-required" aria-hidden="true">*</span>}
                </label>
            )}

            <div className={clsx(
                'ds-select-container',
                `ds-select-container--${size}`,
                {
                    'ds-select-container--error': !!error,
                    'ds-select-container--disabled': disabled,
                }
            )}>
                <select
                    ref={ref}
                    id={selectId}
                    className="ds-select"
                    disabled={disabled}
                    required={required}
                    aria-invalid={!!error}
                    aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <span className="ds-select-icon">
                    <FiChevronDown size={18} />
                </span>
            </div>

            {hint && !error && (
                <span id={hintId} className="ds-select-hint">{hint}</span>
            )}

            {error && (
                <span id={errorId} className="ds-select-error" role="alert">{error}</span>
            )}
        </div>
    );
});

Select.displayName = 'Select';

export default Select;
