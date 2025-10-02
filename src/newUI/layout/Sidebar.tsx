import type { ReactNode } from 'react';
import clsx from 'clsx';
import './layout.css';

export type SidebarNavItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  href?: string;
  active?: boolean;
  onClick?: () => void;
};

export type SidebarSection = {
  key: string;
  title?: ReactNode;
  items: SidebarNavItem[];
};

export type SidebarProps = {
  sections: SidebarSection[];
  footer?: ReactNode;
  className?: string;
};

export const Sidebar = ({ sections, footer, className }: SidebarProps) => {
  return (
    <div className={clsx('ui-sidebar', className)}>
      {sections.map((section) => (
        <div key={section.key} className="ui-sidebar__section">
          {section.title && (
            <div className="ui-sidebar__section-title">{section.title}</div>
          )}
          <nav className="ui-sidebar__nav">
            {section.items.map((item) => {
              const content = (
                <span className="ui-sidebar__item" data-active={item.active}>
                  {item.icon && <span className="ui-sidebar__item-icon">{item.icon}</span>}
                  <span className="ui-sidebar__item-label">{item.label}</span>
                </span>
              );

              if (item.href) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    onClick={item.onClick}
                    className="ui-sidebar__link"
                  >
                    {content}
                  </a>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className="ui-sidebar__link"
                  aria-pressed={item.active}
                >
                  {content}
                </button>
              );
            })}
          </nav>
        </div>
      ))}

      {footer && <div className="ui-sidebar__footer">{footer}</div>}
    </div>
  );
};
