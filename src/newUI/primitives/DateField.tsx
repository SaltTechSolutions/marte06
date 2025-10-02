import type { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import './forms.css';

export type DateFieldProps = {
  id?: string;
  label?: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  invalid?: boolean;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const DateField = ({
  id,
  label,
  description,
  message,
  invalid,
  className,
  inputClassName,
  required,
  ...rest
}: DateFieldProps) => {
  const fieldId = id ?? rest.name ?? undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = message ? `${fieldId}-message` : undefined;

  return (
    <div className={clsx('ui-field', className)}>
      {label && (
        <label className="ui-field__label" htmlFor={fieldId}>
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
      )}
      {description && (
        <div id={descriptionId} className="ui-field__description">
          {description}
        </div>
      )}
      <div className="ui-field__control">
        <input
          id={fieldId}
          type="date"
          className={clsx('ui-date-input', inputClassName)}
          aria-invalid={invalid || undefined}
          aria-describedby={[descriptionId, messageId].filter(Boolean).join(' ') || undefined}
          required={required}
          {...rest}
        />
      </div>
      {message && (
        <div id={messageId} className="ui-field__message" role={invalid ? 'alert' : undefined}>
          {message}
        </div>
      )}
    </div>
  );
};
