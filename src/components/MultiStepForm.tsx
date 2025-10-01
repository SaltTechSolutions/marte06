// src/components/MultiStepForm.tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import './MultiStepForm.css';

interface Step {
  title: string;
  component: ReactNode;
}

interface MultiStepFormProps {
  steps: Step[];
  onComplete: () => void;
  onCancel: () => void;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  validateStep?: (step: number) => boolean;
  getStepValidationStatus?: (step: number) => 'valid' | 'invalid' | 'untouched';
}

const MultiStepForm = ({ 
  steps, 
  onComplete, 
  onCancel,
  currentStep: externalStep,
  onStepChange,
  validateStep,
  getStepValidationStatus
}: MultiStepFormProps) => {
  const [internalStep, setInternalStep] = useState(0);
  const currentStep = externalStep !== undefined ? externalStep : internalStep;
  
  const handleStepChange = (newStep: number) => {
    if (onStepChange) {
      onStepChange(newStep);
    } else {
      setInternalStep(newStep);
    }
  };

  const goToNext = () => {
    // Validate current step before proceeding
    if (validateStep && !validateStep(currentStep)) {
      return; // Don't proceed if validation fails
    }

    if (currentStep < steps.length - 1) {
      handleStepChange(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const goToPrevious = () => {
    if (currentStep > 0) {
      handleStepChange(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step < steps.length) {
      handleStepChange(step);
    }
  };

  return (
    <div className="multi-step-form">
      {/* Progress Indicator */}
      <div className="step-indicator">
        {steps.map((step, index) => {
          const validationStatus = getStepValidationStatus ? getStepValidationStatus(index) : 'untouched';
          const isInvalid = validationStatus === 'invalid';
          
          return (
            <div
              key={index}
              className={`step-item ${index === currentStep ? 'active' : ''} ${
                index < currentStep ? 'completed' : ''
              } ${isInvalid ? 'invalid' : ''}`}
              onClick={() => goToStep(index)}
            >
              <div className="step-number">
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div className="step-title">{step.title}</div>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="step-content">
        {steps[currentStep].component}
      </div>

      {/* Navigation Buttons */}
      <div className="step-navigation">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-outline"
        >
          İptal
        </button>
        
        <div className="step-nav-right">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={goToPrevious}
              className="btn btn-outline"
            >
              Geri
            </button>
          )}
          
          <button
            type="button"
            onClick={goToNext}
            className="btn btn-primary"
          >
            {currentStep === steps.length - 1 ? 'Tamamla' : 'İleri'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiStepForm;
