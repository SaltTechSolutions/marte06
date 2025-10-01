// src/components/LoadingSpinner.tsx
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  message?: string;
}

const LoadingSpinner = ({ 
  size = 'medium', 
  fullScreen = false,
  message 
}: LoadingSpinnerProps) => {
  if (fullScreen) {
    return (
      <div className="loading-spinner-overlay">
        <div className="loading-spinner-content">
          <div className={`spinner spinner-${size}`}>
            <div className="spinner-circle"></div>
          </div>
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-spinner-inline">
      <div className={`spinner spinner-${size}`}>
        <div className="spinner-circle"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
