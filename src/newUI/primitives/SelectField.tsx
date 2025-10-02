import type { ReactNode, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';
import './forms.css';

export type SelectFieldOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectFieldProps = {
  id?: string;
  label?: ReactNode;
  description?: ReactNode;
  message?: ReactNode;
  invalid?: boolean;
  options: SelectFieldOption[];
  placeholder?: ReactNode;
  selectClassName?: string;
} & SelectHTMLAttributes<HTMLSelectElement>;

export const SelectField = ({
  id,
  label,
  description,
  message,
  invalid,
  options,
  placeholder,
  className,
  selectClassName,
  required,
  ...rest
}: SelectFieldProps) => {
  const {
    value,
    defaultValue,
    ...selectRest
  } = rest;

  const fieldId = id ?? rest.name ?? undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = message ? `${fieldId}-message` : undefined;

  const shouldUsePlaceholderDefault =
    placeholder !== undefined && value === undefined && defaultValue === undefined;

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
        <select
          id={fieldId}
          className={clsx('ui-select', selectClassName)}
          aria-invalid={invalid || undefined}
          aria-describedby={[descriptionId, messageId].filter(Boolean).join(' ') || undefined}
          required={required}
          value={value}
          defaultValue={value === undefined ? (defaultValue ?? (shouldUsePlaceholderDefault ? '' : undefined)) : undefined}
          {...selectRest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="ui-select__chevron" aria-hidden>
          ▾
        </span>
      </div>
      {message && (
        <div id={messageId} className="ui-field__message" role={invalid ? 'alert' : undefined}>
          {message}
        </div>
      )}
    </div>
  );
};
