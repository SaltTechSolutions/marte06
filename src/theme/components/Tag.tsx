import type { ReactNode, HTMLAttributes } from 'react';
import clsx from 'clsx';
import './primitives.css';

export type TagTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: TagTone;
  icon?: ReactNode;
}

const toneClassMap: Record<TagTone, string> = {
  default: 'ui-chip ui-chip--muted',
  primary: 'ui-chip',
  success: 'ui-chip ui-chip--success',
  warning: 'ui-chip ui-chip--warning',
  danger: 'ui-chip ui-chip--danger',
};

const Tag = ({ children, tone = 'default', icon, className, ...rest }: TagProps) => {
  return (
    <span className={clsx(toneClassMap[tone], className)} {...rest}>
      {icon && <span aria-hidden>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default Tag;
