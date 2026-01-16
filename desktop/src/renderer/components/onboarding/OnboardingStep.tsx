import React from 'react';

interface OnboardingStepProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Common wrapper for onboarding step content
 * Provides consistent layout with icon, title, and content area
 */
export function OnboardingStep({ icon, title, subtitle, children }: OnboardingStepProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Icon */}
      <div className="text-5xl mb-4">{icon}</div>

      {/* Title */}
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>

      {/* Subtitle */}
      {subtitle && <p className="text-gray-400 mb-6 text-sm">{subtitle}</p>}

      {/* Content */}
      <div className="w-full">{children}</div>
    </div>
  );
}
