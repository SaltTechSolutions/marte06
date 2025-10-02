import { forwardRef } from 'react';
import clsx from 'clsx';
import './primitives.css';

type SpinnerSize = 'sm' | 'md' | 'lg';

type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
  "aria-label"?: string;
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = 'md', className, "aria-label": ariaLabel = 'Yükleniyor' }, ref) => {
    return (
      <span
        ref={ref}
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        className={clsx('ui-spinner', className)}
        data-size={size}
      />
    );
  },
);

Spinner.displayName = 'Spinner';
