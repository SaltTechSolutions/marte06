// src/components/DataLoader.tsx
// Yeniden kullanılabilir loading/error/empty state wrapper

import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import './DataLoader.css';

export interface DataLoaderProps {
    loading: boolean;
    error?: string | null;
    empty?: boolean;
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    children: React.ReactNode;
    loadingMessage?: string;
    retry?: () => void;
    className?: string;
}

const DataLoader: React.FC<DataLoaderProps> = ({
    loading,
    error,
    empty = false,
    emptyMessage = 'Veri bulunamadı.',
    emptyIcon,
    children,
    loadingMessage = 'Yükleniyor...',
    retry,
    className = '',
}) => {
    if (loading) {
        return (
            <div className={`data-loader data-loader--loading ${className}`}>
                <LoadingSpinner message={loadingMessage} />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`data-loader data-loader--error ${className}`}>
                <div className="data-loader__error-icon">⚠️</div>
                <p className="data-loader__error-message">{error}</p>
                {retry && (
                    <button
                        type="button"
                        className="data-loader__retry-button"
                        onClick={retry}
                    >
                        Tekrar Dene
                    </button>
                )}
            </div>
        );
    }

    if (empty) {
        return (
            <div className={`data-loader data-loader--empty ${className}`}>
                {emptyIcon && <div className="data-loader__empty-icon">{emptyIcon}</div>}
                <p className="data-loader__empty-message">{emptyMessage}</p>
            </div>
        );
    }

    return <>{children}</>;
};

export default DataLoader;
