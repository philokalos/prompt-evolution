import React, { useState, useEffect, useCallback } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { WelcomeStep } from './WelcomeStep';
import { PermissionStep } from './PermissionStep';
import { HotkeyTestStep } from './HotkeyTestStep';
import { CompleteStep } from './CompleteStep';
import type { OnboardingStage } from '../../electron';

interface OnboardingProps {
  initialStage?: OnboardingStage;
  onComplete: () => void;
  onSkip: () => void;
}

const STAGE_TO_STEP: Record<OnboardingStage, number> = {
  welcome: 1,
  permission: 2,
  hotkey: 3,
  complete: 4,
  done: 4,
};

const STEP_TO_STAGE: Record<number, OnboardingStage> = {
  1: 'welcome',
  2: 'permission',
  3: 'hotkey',
  4: 'complete',
};

/**
 * Main onboarding wizard container
 * Manages step navigation and state persistence
 */
export function Onboarding({ initialStage = 'welcome', onComplete, onSkip }: OnboardingProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(STAGE_TO_STEP[initialStage] || 1);
  const [hasAccessibility, setHasAccessibility] = useState(false);
  const [hotkeyVerified, setHotkeyVerified] = useState(false);
  const [demoCompleted, setDemoCompleted] = useState(false);

  const totalSteps = 4;

  // Check accessibility permission on mount and periodically
  useEffect(() => {
    const checkPermission = async (): Promise<void> => {
      try {
        const hasAccess = await window.electronAPI.checkAccessibility();
        setHasAccessibility(hasAccess);
      } catch (error) {
        console.error('[Onboarding] Failed to check accessibility:', error);
      }
    };

    checkPermission();

    // Poll for permission changes when on permission step
    if (currentStep === 2) {
      const interval = setInterval(checkPermission, 1000);
      return () => clearInterval(interval);
    }
  }, [currentStep]);

  // Save stage to persistent storage
  const saveStage = useCallback(async (stage: OnboardingStage): Promise<void> => {
    try {
      await window.electronAPI.setOnboardingStage(stage);
    } catch (error) {
      console.error('[Onboarding] Failed to save stage:', error);
    }
  }, []);

  // Navigate to next step
  const goToNextStep = useCallback((): void => {
    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveStage(STEP_TO_STAGE[nextStep]);
    } else {
      // Complete onboarding
      saveStage('done');
      onComplete();
    }
  }, [currentStep, totalSteps, saveStage, onComplete]);

  // Navigate to previous step
  const goToPrevStep = useCallback((): void => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveStage(STEP_TO_STAGE[prevStep]);
    }
  }, [currentStep, saveStage]);

  // Handle skip (mark as done)
  const handleSkip = useCallback((): void => {
    saveStage('done');
    onSkip();
  }, [saveStage, onSkip]);

  // Handle demo completion
  const handleDemoComplete = useCallback((): void => {
    setDemoCompleted(true);
  }, []);

  // Handle hotkey verification
  const handleHotkeyVerified = useCallback((): void => {
    setHotkeyVerified(true);
    // Auto-advance after brief delay
    setTimeout(() => {
      goToNextStep();
    }, 1500);
  }, [goToNextStep]);

  // Render current step content
  const renderStep = (): React.ReactNode => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep onDemoComplete={handleDemoComplete} demoCompleted={demoCompleted} />;
      case 2:
        return <PermissionStep hasAccessibility={hasAccessibility} />;
      case 3:
        return <HotkeyTestStep onVerified={handleHotkeyVerified} verified={hotkeyVerified} />;
      case 4:
        return <CompleteStep hasAccessibility={hasAccessibility} hotkeyVerified={hotkeyVerified} />;
      default:
        return null;
    }
  };

  // Determine if next button should be enabled
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return demoCompleted; // Must complete demo
      case 2:
        return true; // Can always proceed (with or without permission)
      case 3:
        return hotkeyVerified; // Must verify hotkey
      case 4:
        return true; // Can always complete
      default:
        return true;
    }
  };

  // Get next button label
  const getNextButtonLabel = (): string => {
    if (currentStep === totalSteps) {
      return '시작하기 🚀';
    }
    return '다음 →';
  };

  return (
    <div className="fixed inset-0 bg-[#0d1117] z-50 flex flex-col">
      {/* Header with progress */}
      <div className="pt-8 px-6">
        <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-md mx-auto">{renderStep()}</div>
      </div>

      {/* Footer with navigation buttons */}
      <div className="p-6 border-t border-gray-800">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Left: Skip or Back button */}
          <button
            onClick={currentStep === 1 ? handleSkip : goToPrevStep}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {currentStep === 1 ? '건너뛰기' : '← 이전'}
          </button>

          {/* Right: Next/Complete button */}
          <button
            onClick={goToNextStep}
            disabled={!canProceed()}
            className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
              canProceed()
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {getNextButtonLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
