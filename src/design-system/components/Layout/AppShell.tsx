// src/design-system/components/Layout/AppShell.tsx
// Mobile-first responsive app shell

import React from 'react';
import { clsx } from 'clsx';
import './AppShell.css';

export interface AppShellProps {
    header?: React.ReactNode;
    sidebar?: React.ReactNode;
    bottomNav?: React.ReactNode;
    fab?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
    header,
    sidebar,
    bottomNav,
    fab,
    children,
    className,
}) => {
    return (
        <div className={clsx('ds-app-shell', className)}>
            {sidebar && <aside className="ds-app-shell__sidebar">{sidebar}</aside>}

            <div className="ds-app-shell__main">
                {header && <header className="ds-app-shell__header">{header}</header>}

                <main className="ds-app-shell__content">
                    {children}
                </main>

                {bottomNav && <nav className="ds-app-shell__bottom-nav">{bottomNav}</nav>}

                {fab && (
                    <div className="ds-app-shell__fab-container">
                        {fab}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppShell;
