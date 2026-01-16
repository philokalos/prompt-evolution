import React from 'react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

/**
 * Onboarding progress indicator showing step dots
 * ●───○───○───○ (Step 1 of 4)
 */
export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <React.Fragment key={stepNum}>
            {/* Step dot */}
            <div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-green-500'
                  : isCurrent
                  ? 'bg-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-gray-600'
              }`}
            />
            {/* Connector line (except after last) */}
            {stepNum < totalSteps && (
              <div
                className={`w-8 h-0.5 transition-all duration-300 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-600'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
