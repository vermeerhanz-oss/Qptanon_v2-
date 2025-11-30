import React from 'react';

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, subtext, onClick, variant = 'default' }) {
  const variantStyles = {
    default: 'text-gray-900',
    success: 'text-green-600',
    warning: 'text-orange-600',
    danger: 'text-red-600',
    info: 'text-blue-600',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-4 text-left w-full ${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${variantStyles[variant]}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </Wrapper>
  );
}