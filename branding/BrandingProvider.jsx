import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const BrandingContext = createContext({
  logoUrl: null,
  primaryColor: '#6366F1',
  secondaryColor: '#0D1117',
  useBranding: false,
  isLoading: true,
  refresh: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({
    logoUrl: null,
    primaryColor: '#6366F1',
    secondaryColor: '#0D1117',
    useBranding: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadBranding = async () => {
    try {
      const settings = await base44.entities.CompanySettings.list();
      if (settings.length > 0) {
        const s = settings[0];
        setBranding({
          logoUrl: s.logo_url || null,
          primaryColor: s.primary_color || '#6366F1',
          secondaryColor: s.secondary_color || '#0D1117',
          useBranding: s.use_branding || false,
        });
      }
    } catch (error) {
      console.error('Error loading branding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  // Apply CSS variables when branding changes
  useEffect(() => {
    if (branding.useBranding) {
      document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
    } else {
      document.documentElement.style.removeProperty('--brand-primary');
      document.documentElement.style.removeProperty('--brand-secondary');
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ ...branding, isLoading, refresh: loadBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Get hex to RGB for CSS variable usage
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}