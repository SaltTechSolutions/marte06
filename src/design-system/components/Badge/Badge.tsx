// src/design-system/components/Badge/Badge.tsx
import React from 'react';
import { clsx } from 'clsx';
import './Badge.css';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    children: React.ReactNode;
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    variant = 'default',
    size = 'md',
    dot = false,
    children,
    className,
}) => {
    return (
        <span
            className={clsx(
                'ds-badge',
                `ds-badge--${variant}`,
                `ds-badge--${size}`,
                { 'ds-badge--dot': dot },
                className
            )}
        >
            {dot && <span className="ds-badge__dot" />}
            {children}
        </span>
    );
};

// Status Badge (for showing online/offline etc.)
export interface StatusBadgeProps {
    status: 'online' | 'offline' | 'busy' | 'away';
    label?: string;
    className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    label,
    className,
}) => {
    const statusLabels = {
        online: 'Çevrimiçi',
        offline: 'Çevrimdışı',
        busy: 'Meşgul',
        away: 'Uzakta',
    };

    return (
        <span className={clsx('ds-status-badge', `ds-status-badge--${status}`, className)}>
            <span className="ds-status-badge__dot" />
            <span className="ds-status-badge__label">{label || statusLabels[status]}</span>
        </span>
    );
};

export default Badge;
