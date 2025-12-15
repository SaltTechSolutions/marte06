// src/newUI/primitives/SwipeableCard.tsx
// Mobil için swipe ile delete/action yapılabilen kart

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { FiTrash2, FiEdit2, FiCheck } from 'react-icons/fi';
import './SwipeableCard.css';

// PanInfo type (framer-motion'dan inline)
type PanInfo = { offset: { x: number; y: number }; velocity: { x: number; y: number } };

export interface SwipeAction {
    id: string;
    icon: React.ReactNode;
    label: string;
    color: string;
    onClick: () => void;
}

export interface SwipeableCardProps {
    children: React.ReactNode;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    swipeThreshold?: number;
    className?: string;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({
    children,
    leftActions = [],
    rightActions = [],
    onSwipeLeft,
    onSwipeRight,
    swipeThreshold = 100,
    className = '',
}) => {
    const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);
    const constraintsRef = useRef<HTMLDivElement>(null);

    const x = useMotionValue(0);
    const rightActionsWidth = rightActions.length * 70;
    const leftActionsWidth = leftActions.length * 70;

    // Sağ action'ların opacity'si (sola kaydırınca görünür)
    const rightOpacity = useTransform(x, [-rightActionsWidth, 0], [1, 0]);
    // Sol action'ların opacity'si (sağa kaydırınca görünür)
    const leftOpacity = useTransform(x, [0, leftActionsWidth], [0, 1]);

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        // Sola kaydırma (sağ action'ları göster)
        if (offset < -swipeThreshold || velocity < -500) {
            if (rightActions.length > 0) {
                setIsRevealed('right');
            } else if (onSwipeLeft) {
                onSwipeLeft();
            }
        }
        // Sağa kaydırma (sol action'ları göster)
        else if (offset > swipeThreshold || velocity > 500) {
            if (leftActions.length > 0) {
                setIsRevealed('left');
            } else if (onSwipeRight) {
                onSwipeRight();
            }
        }
        // Normal duruma dön
        else {
            setIsRevealed(null);
        }
    };

    const resetPosition = () => {
        setIsRevealed(null);
    };

    const getAnimateX = () => {
        if (isRevealed === 'right') return -rightActionsWidth;
        if (isRevealed === 'left') return leftActionsWidth;
        return 0;
    };

    return (
        <div className={`swipeable-card-container ${className}`} ref={constraintsRef}>
            {/* Sol action'lar (sağa kaydırınca görünür) */}
            {leftActions.length > 0 && (
                <motion.div
                    className="swipeable-actions swipeable-actions--left"
                    style={{ opacity: leftOpacity }}
                >
                    {leftActions.map((action) => (
                        <button
                            key={action.id}
                            className="swipeable-action-btn"
                            style={{ backgroundColor: action.color }}
                            onClick={() => {
                                action.onClick();
                                resetPosition();
                            }}
                            aria-label={action.label}
                        >
                            {action.icon}
                        </button>
                    ))}
                </motion.div>
            )}

            {/* Sağ action'lar (sola kaydırınca görünür) */}
            {rightActions.length > 0 && (
                <motion.div
                    className="swipeable-actions swipeable-actions--right"
                    style={{ opacity: rightOpacity }}
                >
                    {rightActions.map((action) => (
                        <button
                            key={action.id}
                            className="swipeable-action-btn"
                            style={{ backgroundColor: action.color }}
                            onClick={() => {
                                action.onClick();
                                resetPosition();
                            }}
                            aria-label={action.label}
                        >
                            {action.icon}
                        </button>
                    ))}
                </motion.div>
            )}

            {/* Ana içerik */}
            <motion.div
                className="swipeable-card-content"
                drag="x"
                dragConstraints={{ left: -rightActionsWidth, right: leftActionsWidth }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                animate={{ x: getAnimateX() }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ x }}
                onClick={() => isRevealed && resetPosition()}
            >
                {children}
            </motion.div>
        </div>
    );
};

// Hazır action presets
export const DELETE_ACTION: SwipeAction = {
    id: 'delete',
    icon: <FiTrash2 size={20} />,
    label: 'Sil',
    color: '#dc2626',
    onClick: () => { },
};

export const EDIT_ACTION: SwipeAction = {
    id: 'edit',
    icon: <FiEdit2 size={20} />,
    label: 'Düzenle',
    color: '#4f46e5',
    onClick: () => { },
};

export const COMPLETE_ACTION: SwipeAction = {
    id: 'complete',
    icon: <FiCheck size={20} />,
    label: 'Tamamla',
    color: '#10b981',
    onClick: () => { },
};

export default SwipeableCard;
