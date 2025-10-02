import type { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import './forms.css';

export type ToggleFieldProps = {
  id?: string;
  label?: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  invalid?: boolean;
  containerClassName?: string;
  toggleClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const ToggleField = ({
  id,
  label,
  description,
  message,
  invalid,
  containerClassName,
  toggleClassName,
  required,
  ...rest
}: ToggleFieldProps) => {
  const { className, ...inputRest } = rest;
  const fieldId = id ?? rest.name ?? undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = message ? `${fieldId}-message` : undefined;

  return (
    <div className={clsx('ui-field', containerClassName)}>
      <label className={clsx('ui-toggle-wrapper', className)} htmlFor={fieldId}>
        <input
          id={fieldId}
          type="checkbox"
          className="ui-toggle-input"
          aria-invalid={invalid || undefined}
          aria-describedby={[descriptionId, messageId].filter(Boolean).join(' ') || undefined}
          required={required}
          {...inputRest}
        />
        <span className={clsx('ui-toggle', toggleClassName)} aria-hidden />
        {label && <span className="ui-field__toggle-text">{label}</span>}
        {required && !label && <span aria-hidden> *</span>}
      </label>
      {description && (
        <div id={descriptionId} className="ui-field__description">
          {description}
        </div>
      )}
      {message && (
        <div id={messageId} className="ui-field__message" role={invalid ? 'alert' : undefined}>
          {message}
        </div>
      )}
    </div>
  );
};
