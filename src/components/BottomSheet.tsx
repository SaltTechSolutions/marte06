// src/components/BottomSheet.tsx
// Mobil için modern bottom sheet component

import React, { useRef, useEffect } from 'react';
import { Sheet, type SheetRef } from 'react-modal-sheet';
import { motion, AnimatePresence } from 'framer-motion';
import './BottomSheet.css';

export interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    snapPoints?: number[];
    initialSnap?: number;
    disableDrag?: boolean;
    onSnap?: (index: number) => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
    isOpen,
    onClose,
    children,
    title,
    snapPoints = [0.9, 0.5, 0],
    initialSnap = 1,
    disableDrag = false,
    onSnap,
}) => {
    const sheetRef = useRef<SheetRef>(null);

    // ESC tuşu ile kapat
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    return (
        <Sheet
            ref={sheetRef}
            isOpen={isOpen}
            onClose={onClose}
            snapPoints={snapPoints}
            initialSnap={initialSnap}
            disableDrag={disableDrag}
            onSnap={onSnap}
        >
            <Sheet.Container className="bottom-sheet-container">
                <Sheet.Header className="bottom-sheet-header">
                    <div className="bottom-sheet-handle" />
                    {title && (
                        <div className="bottom-sheet-title-row">
                            <h3 className="bottom-sheet-title">{title}</h3>
                            <button
                                type="button"
                                className="bottom-sheet-close"
                                onClick={onClose}
                                aria-label="Kapat"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </Sheet.Header>
                <Sheet.Content className="bottom-sheet-content">
                    <div className="bottom-sheet-scroll">
                        {children}
                    </div>
                </Sheet.Content>
            </Sheet.Container>
            <Sheet.Backdrop className="bottom-sheet-backdrop" onTap={onClose} />
        </Sheet>
    );
};

// Basit bir action sheet versiyonu
export interface ActionSheetItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
}

export interface ActionSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    items: ActionSheetItem[];
    cancelLabel?: string;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
    isOpen,
    onClose,
    title,
    items,
    cancelLabel = 'İptal',
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="action-sheet-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="action-sheet"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    >
                        {title && <div className="action-sheet-title">{title}</div>}
                        <div className="action-sheet-items">
                            {items.map((item, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    className={`action-sheet-item ${item.destructive ? 'destructive' : ''}`}
                                    onClick={() => {
                                        item.onClick();
                                        onClose();
                                    }}
                                    disabled={item.disabled}
                                >
                                    {item.icon && <span className="action-sheet-item-icon">{item.icon}</span>}
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="action-sheet-cancel"
                            onClick={onClose}
                        >
                            {cancelLabel}
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default BottomSheet;
