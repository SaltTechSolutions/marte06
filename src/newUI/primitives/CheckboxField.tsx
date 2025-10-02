import type { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import './forms.css';

export type CheckboxFieldProps = {
  id?: string;
  label?: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  invalid?: boolean;
  containerClassName?: string;
  checkboxClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const CheckboxField = ({
  id,
  label,
  description,
  message,
  invalid,
  containerClassName,
  checkboxClassName,
  className,
  required,
  ...rest
}: CheckboxFieldProps) => {
  const fieldId = id ?? rest.name ?? undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = message ? `${fieldId}-message` : undefined;

  return (
    <div className={clsx('ui-field', containerClassName)}>
      <label className={clsx('ui-field__checkbox-label', className)} htmlFor={fieldId}>
        <input
          id={fieldId}
          type="checkbox"
          className={clsx('ui-checkbox', checkboxClassName)}
          aria-invalid={invalid || undefined}
          aria-describedby={[descriptionId, messageId].filter(Boolean).join(' ') || undefined}
          required={required}
          {...rest}
        />
        {label && <span className="ui-field__checkbox-text">{label}</span>}
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
