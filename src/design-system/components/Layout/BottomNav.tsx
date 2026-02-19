// src/design-system/components/Layout/BottomNav.tsx
// Mobile bottom navigation

import React from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { FiHome, FiUsers, FiCalendar, FiPackage, FiSettings } from 'react-icons/fi';
import { motion } from 'framer-motion';
import './BottomNav.css';

export interface NavItem {
    to: string;
    icon: React.ReactNode;
    label: string;
}

export interface BottomNavProps {
    items?: NavItem[];
    className?: string;
}

const defaultItems: NavItem[] = [
    { to: '/dashboard', icon: <FiHome size={22} />, label: 'Ana Sayfa' },
    { to: '/members', icon: <FiUsers size={22} />, label: 'Üyeler' },
    { to: '/calendar', icon: <FiCalendar size={22} />, label: 'Takvim' },
    { to: '/packages', icon: <FiPackage size={22} />, label: 'Paketler' },
    { to: '/settings', icon: <FiSettings size={22} />, label: 'Ayarlar' },
];

export const BottomNav: React.FC<BottomNavProps> = ({
    items = defaultItems,
    className,
}) => {
    return (
        <div className={clsx('ds-bottom-nav', className)}>
            {items.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        clsx('ds-bottom-nav__item', { 'ds-bottom-nav__item--active': isActive })
                    }
                >
                    {({ isActive }) => (
                        <motion.div
                            className="ds-bottom-nav__inner"
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                            <span className="ds-bottom-nav__icon">
                                {item.icon}
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill"
                                        className="ds-bottom-nav__pill"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </span>
                            <span className="ds-bottom-nav__label">{item.label}</span>
                        </motion.div>
                    )}
                </NavLink>
            ))}
        </div>
    );
};

export default BottomNav;
