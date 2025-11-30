import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { number: 1, title: 'New Hire Details', subtitle: 'Personal info & role' },
  { number: 2, title: 'Employment Setup', subtitle: 'Entity, type & hours' },
  { number: 3, title: 'Compensation', subtitle: 'Pay & contract' },
  { number: 4, title: 'Onboarding Plan', subtitle: 'Tasks & policies' },
];

export default function WizardStepper({ currentStep, completedSteps = [] }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isComplete = completedSteps.includes(step.number);
          const isCurrent = currentStep === step.number;
          const isPast = currentStep > step.number;

          return (
            <li key={step.number} className="relative flex-1">
              <div className="flex flex-col items-center">
                {/* Connector line */}
                {index !== STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-5 left-1/2 w-full h-0.5',
                      isPast || isComplete ? 'bg-indigo-600' : 'bg-gray-200'
                    )}
                  />
                )}

                {/* Step circle */}
                <div
                  className={cn(
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    isCurrent
                      ? 'border-indigo-600 bg-white text-indigo-600'
                      : isComplete || isPast
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                  )}
                >
                  {isComplete || isPast ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.number}</span>
                  )}
                </div>

                {/* Step label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCurrent ? 'text-indigo-600' : 'text-gray-900'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    {step.subtitle}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}