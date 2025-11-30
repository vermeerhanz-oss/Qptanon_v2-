import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Circular progress indicator
 */
export default function OnboardingProgressRing({ 
  percentage = 0, 
  size = 48,
  strokeWidth = 4,
  className,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 100) return 'text-green-500';
    if (percentage >= 50) return 'text-blue-500';
    return 'text-indigo-500';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-300', getColor())}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-gray-700">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}