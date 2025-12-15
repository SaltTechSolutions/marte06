// src/design-system/components/Card/Card.tsx
import React from 'react';
import { clsx } from 'clsx';
import './Card.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'elevated' | 'outlined' | 'filled';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    interactive?: boolean;
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
    variant = 'elevated',
    padding = 'md',
    interactive = false,
    className,
    children,
    ...props
}) => {
    return (
        <div
            className={clsx(
                'ds-card',
                `ds-card--${variant}`,
                `ds-card--p-${padding}`,
                { 'ds-card--interactive': interactive },
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

// Card Header
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
    title,
    subtitle,
    action,
    className,
    ...props
}) => {
    return (
        <div className={clsx('ds-card-header', className)} {...props}>
            <div className="ds-card-header__content">
                <h3 className="ds-card-header__title">{title}</h3>
                {subtitle && <p className="ds-card-header__subtitle">{subtitle}</p>}
            </div>
            {action && <div className="ds-card-header__action">{action}</div>}
        </div>
    );
};

// Card Content
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className,
    children,
    ...props
}) => {
    return (
        <div className={clsx('ds-card-content', className)} {...props}>
            {children}
        </div>
    );
};

// Card Footer
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className,
    children,
    ...props
}) => {
    return (
        <div className={clsx('ds-card-footer', className)} {...props}>
            {children}
        </div>
    );
};

export default Card;
