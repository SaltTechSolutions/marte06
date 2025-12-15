// src/newUI/primitives/PullToRefresh.tsx
// Pull-to-refresh wrapper component

import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import './PullToRefresh.css';

export interface PullToRefreshProps {
    children: React.ReactNode;
    onRefresh: () => Promise<void>;
    threshold?: number;
    className?: string;
    disabled?: boolean;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
    children,
    onRefresh,
    threshold = 80,
    className = '',
    disabled = false,
}) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);

    const pullDistance = useMotionValue(0);
    const spinnerOpacity = useTransform(pullDistance, [0, threshold / 2, threshold], [0, 0.5, 1]);
    const spinnerRotation = useTransform(pullDistance, [0, threshold], [0, 360]);
    const spinnerScale = useTransform(pullDistance, [0, threshold], [0.5, 1]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) return;

        startY.current = e.touches[0].clientY;
        setIsPulling(true);
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling || disabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) {
            pullDistance.set(0);
            return;
        }

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Yavaşlama efekti (logaritmik)
            const dampedDiff = Math.min(diff * 0.5, threshold * 1.5);
            pullDistance.set(dampedDiff);

            // Scroll'u engelle
            if (container.scrollTop === 0) {
                e.preventDefault();
            }
        }
    }, [isPulling, disabled, isRefreshing, pullDistance, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling) return;

        const currentPull = pullDistance.get();

        if (currentPull >= threshold && !isRefreshing) {
            setIsRefreshing(true);

            // Animasyonla threshold'a çek
            pullDistance.set(threshold);

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }

        // Sıfırla
        pullDistance.set(0);
        setIsPulling(false);
    }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

    return (
        <div
            ref={containerRef}
            className={`pull-to-refresh ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            <motion.div
                className="pull-indicator"
                style={{
                    height: pullDistance,
                    opacity: spinnerOpacity,
                }}
            >
                <motion.div
                    className={`pull-spinner ${isRefreshing ? 'spinning' : ''}`}
                    style={{
                        rotate: isRefreshing ? undefined : spinnerRotation,
                        scale: spinnerScale,
                    }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                </motion.div>
                <span className="pull-text">
                    {isRefreshing ? 'Yenileniyor...' : pullDistance.get() >= threshold ? 'Bırakın' : 'Çekin'}
                </span>
            </motion.div>

            {/* Content */}
            <motion.div
                className="pull-content"
                style={{ y: pullDistance }}
            >
                {children}
            </motion.div>
        </div>
    );
};

export default PullToRefresh;
