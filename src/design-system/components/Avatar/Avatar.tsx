// src/design-system/components/Avatar/Avatar.tsx
import React from 'react';
import { clsx } from 'clsx';
import './Avatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
    name: string;
    src?: string;
    size?: AvatarSize;
    className?: string;
}

// Generate consistent color from name
const getColorFromName = (name: string): string => {
    const colors = [
        'var(--color-primary-500)',
        'var(--color-success-500)',
        'var(--color-warning-500)',
        'var(--color-error-500)',
        'var(--color-info-500)',
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#14b8a6', // teal
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Get initials from name
const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

export const Avatar: React.FC<AvatarProps> = ({
    name,
    src,
    size = 'md',
    className,
}) => {
    const [imageError, setImageError] = React.useState(false);
    const showFallback = !src || imageError;

    return (
        <div
            className={clsx('ds-avatar', `ds-avatar--${size}`, className)}
            style={showFallback ? { backgroundColor: getColorFromName(name) } : undefined}
            title={name}
        >
            {showFallback ? (
                <span className="ds-avatar__initials">{getInitials(name)}</span>
            ) : (
                <img
                    src={src}
                    alt={name}
                    className="ds-avatar__image"
                    onError={() => setImageError(true)}
                />
            )}
        </div>
    );
};

// Avatar Group
export interface AvatarGroupProps {
    children: React.ReactNode;
    max?: number;
    size?: AvatarSize;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
    children,
    max = 4,
    size = 'md',
}) => {
    const childArray = React.Children.toArray(children);
    const visibleAvatars = childArray.slice(0, max);
    const remainingCount = childArray.length - max;

    return (
        <div className="ds-avatar-group">
            {visibleAvatars.map((child, index) => (
                <div key={index} className="ds-avatar-group__item">
                    {React.isValidElement(child)
                        ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
                        : child
                    }
                </div>
            ))}
            {remainingCount > 0 && (
                <div className={clsx('ds-avatar', `ds-avatar--${size}`, 'ds-avatar--count')}>
                    <span className="ds-avatar__initials">+{remainingCount}</span>
                </div>
            )}
        </div>
    );
};

export default Avatar;
