import type { PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';
import './layout.css';

export type AppShellProps = PropsWithChildren<{
  header: ReactNode;
  sidebar?: ReactNode;
  sidebarCollapsed?: boolean;
  paddedContent?: boolean;
  className?: string;
}>;

export const AppShell = ({
  header,
  sidebar,
  sidebarCollapsed = false,
  paddedContent = true,
  className,
  children,
}: AppShellProps) => {
  return (
    <div
      className={clsx('ui-app-shell', className)}
      data-sidebar-collapsed={sidebarCollapsed}
    >
      <header className="ui-app-shell__header">{header}</header>
      {sidebar && <aside className="ui-app-shell__sidebar">{sidebar}</aside>}
      <main className="ui-app-shell__content" data-padded={paddedContent}>
        {children}
      </main>
    </div>
  );
};
