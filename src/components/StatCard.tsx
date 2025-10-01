// src/components/StatCard.tsx
import type { ReactNode } from 'react';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  loading?: boolean;
}

const StatCard = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  variant = 'default',
  loading = false
}: StatCardProps) => {
  if (loading) {
    return (
      <div className={`stat-card stat-card-${variant} stat-card-loading`}>
        <div className="stat-card-skeleton">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-value"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>
      
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        
        {trend && (
          <div className={`stat-card-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
            <span className="trend-arrow">{trend.isPositive ? '↑' : '↓'}</span>
            <span className="trend-value">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      
      {subtitle && (
        <div className="stat-card-footer">
          <span className="stat-card-subtitle">{subtitle}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
