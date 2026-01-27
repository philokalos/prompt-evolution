import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight, ChevronLeft, Check, Keyboard, Zap, Clipboard, Ghost } from 'lucide-react';

interface OnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Keyboard,
    titleKey: 'step1.title',
    descriptionKey: 'step1.description',
    tipsKey: 'step1.tips',
  },
  {
    icon: Zap,
    titleKey: 'step2.title',
    descriptionKey: 'step2.description',
    tipsKey: 'step2.tips',
  },
  {
    icon: Clipboard,
    titleKey: 'step3.title',
    descriptionKey: 'step3.description',
    tipsKey: 'step3.tips',
  },
  {
    icon: Ghost,
    titleKey: 'step4.title',
    descriptionKey: 'step4.description',
    tipsKey: 'step4.tips',
  },
];

export default function Onboarding({ isOpen, onComplete }: OnboardingProps) {
  const { t } = useTranslation('onboarding');
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const isLastStep = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-surface rounded-xl border border-dark-border w-[480px] max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-purple-500 flex items-center justify-center">
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('title')}</h2>
              <p className="text-xs text-gray-400">
                {t('stepProgress', { current: currentStep + 1, total: STEPS.length })}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-1 rounded hover:bg-dark-hover transition-colors"
            aria-label={t('skip')}
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-accent-primary' : 'bg-dark-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-purple-500/20 flex items-center justify-center border border-accent-primary/30">
              <Icon size={32} className="text-accent-primary" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-center text-gray-100">
            {t(step.titleKey)}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-300 text-center leading-relaxed">
            {t(step.descriptionKey)}
          </p>

          {/* Tips */}
          <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold text-accent-primary uppercase tracking-wide">
              {t('tips')}
            </h4>
            <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
              {(t(step.tipsKey, { returnObjects: true }) as string[]).map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-border flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              currentStep === 0
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:bg-dark-hover'
            }`}
          >
            <ChevronLeft size={16} />
            {t('previous')}
          </button>

          <button
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {t('skip')}
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium transition-colors"
          >
            {isLastStep ? (
              <>
                <Check size={16} />
                {t('getStarted')}
              </>
            ) : (
              <>
                {t('next')}
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
