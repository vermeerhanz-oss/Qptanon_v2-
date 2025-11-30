import React from 'react';
import { useBranding } from './BrandingProvider';
import Logo from '@/components/brand/Logo';

/**
 * Branded Logo Component
 * Shows company logo if branding is enabled, otherwise shows default Logo
 */
export default function BrandedLogo({ 
  variant = 'full',
  size = 'md',
  darkBg = false,
  className = ''
}) {
  const branding = useBranding();
  const { logoUrl, useBranding: isBrandingEnabled } = branding;

  const sizes = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
  };

  // If branding is enabled and logo exists, show custom logo
  if (isBrandingEnabled && logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt="Company Logo" 
        style={{ height: sizes[size] }}
        className={`object-contain ${className}`}
      />
    );
  }

  // Otherwise show default logo
  return (
    <Logo 
      variant={variant} 
      size={size} 
      darkBg={darkBg} 
      className={className} 
    />
  );
}