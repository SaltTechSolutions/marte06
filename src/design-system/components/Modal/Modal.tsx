// src/design-system/components/Modal/Modal.tsx
// Accessible modal component

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { FiX } from 'react-icons/fi';
import './Modal.css';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
    children: React.ReactNode;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    size = 'md',
    children,
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // ESC key handler
    useEffect(() => {
        if (!closeOnEscape || !isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, closeOnEscape]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Focus trap
    useEffect(() => {
        if (isOpen && modalRef.current) {
            modalRef.current.focus();
        }
    }, [isOpen]);

    const content = (
        <AnimatePresence>
            {isOpen && (
                <div className="ds-modal-portal">
                    {/* Backdrop */}
                    <motion.div
                        className="ds-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={closeOnBackdrop ? onClose : undefined}
                    />

                    {/* Modal */}
                    <motion.div
                        ref={modalRef}
                        className={clsx('ds-modal', `ds-modal--${size}`)}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? 'modal-title' : undefined}
                        tabIndex={-1}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                        {/* Header */}
                        {(title || showCloseButton) && (
                            <div className="ds-modal__header">
                                {title && (
                                    <h2 id="modal-title" className="ds-modal__title">
                                        {title}
                                    </h2>
                                )}
                                {showCloseButton && (
                                    <button
                                        type="button"
                                        className="ds-modal__close"
                                        onClick={onClose}
                                        aria-label="Kapat"
                                    >
                                        <FiX size={20} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="ds-modal__content">{children}</div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
};

// Modal Footer helper
export const ModalFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className,
}) => {
    return <div className={clsx('ds-modal__footer', className)}>{children}</div>;
};

export default Modal;
