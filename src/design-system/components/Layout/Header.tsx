// src/design-system/components/Layout/Header.tsx
// Responsive header component

import React from 'react';
import { clsx } from 'clsx';
import './Header.css';

export interface HeaderProps {
    title: string;
    subtitle?: string;
    leftAction?: React.ReactNode;
    rightAction?: React.ReactNode;
    className?: string;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    leftAction,
    rightAction,
    className,
}) => {
    return (
        <header className={clsx('ds-header', className)}>
            <div className="ds-header__left">
                {leftAction}
            </div>

            <div className="ds-header__center">
                <h1 className="ds-header__title">{title}</h1>
                {subtitle && <p className="ds-header__subtitle">{subtitle}</p>}
            </div>

            <div className="ds-header__right">
                {rightAction}
            </div>
        </header>
    );
};

export default Header;
