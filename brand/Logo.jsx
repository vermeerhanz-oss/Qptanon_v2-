import React from 'react';

/**
 * FoundersCrew Logo
 * Based on uploaded logo: rocket with orbital trail + star on deep navy
 */
export default function Logo({ 
  variant = 'full',  // 'full' | 'mark' | 'wordmark'
  size = 'md',       // 'sm' | 'md' | 'lg' | 'xl'
  darkBg = false,
  className = ''
}) {
  const sizes = {
    sm: { height: 32, fontSize: 'text-lg' },
    md: { height: 40, fontSize: 'text-xl' },
    lg: { height: 56, fontSize: 'text-2xl' },
    xl: { height: 72, fontSize: 'text-3xl' },
  };

  const s = sizes[size];
  const textColor = darkBg ? 'text-[#F5F5F0]' : 'text-slate-900';
  
  // Rocket SVG matching the uploaded logo style
  const RocketMark = ({ height }) => (
    <svg 
      height={height} 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      {/* Rocket body */}
      <path
        d="M28 8C28 8 32 12 32 20C32 28 28 32 24 36C20 32 16 28 16 20C16 12 20 8 20 8C20 8 22 6 24 6C26 6 28 8 28 8Z"
        fill={darkBg ? '#F5F5F0' : '#0D1117'}
      />
      {/* Rocket window */}
      <circle cx="24" cy="18" r="3" fill={darkBg ? '#0D1117' : '#F5F5F0'} />
      {/* Orbital trail */}
      <path
        d="M12 28C12 28 8 32 8 36C8 40 12 42 16 42C20 42 24 40 28 36"
        stroke={darkBg ? '#F5F5F0' : '#0D1117'}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Star sparkle */}
      <path
        d="M38 14L40 16L42 14L40 12L38 14Z"
        fill={darkBg ? '#F5F5F0' : '#0D1117'}
      />
      <path
        d="M40 10V18M36 14H44"
        stroke={darkBg ? '#F5F5F0' : '#0D1117'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === 'mark') {
    return <RocketMark height={s.height} />;
  }

  if (variant === 'wordmark') {
    return (
      <span className={`${s.fontSize} font-bold ${textColor} tracking-tight ${className}`}>
        FoundersCrew
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <RocketMark height={s.height} />
      <span className={`${s.fontSize} font-bold ${textColor} tracking-tight`}>
        FoundersCrew
      </span>
    </div>
  );
}