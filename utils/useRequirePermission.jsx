import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

/**
 * Hook to guard pages based on permissions
 * 
 * @param {Object} context - Employee context from getCurrentUserEmployeeContext
 * @param {string} permissionKey - Key from permissions object (e.g., 'canViewReports')
 * @param {Object} options - Additional options
 * @param {boolean} options.requireAdminMode - Whether acting_mode must be 'admin' (default: true)
 * @param {string} options.redirectTo - Page to redirect to (default: 'Home')
 * @param {string} options.message - Toast message to show on redirect
 * @returns {{ isAllowed: boolean, isLoading: boolean }}
 */
export function useRequirePermission(context, permissionKey, options = {}) {
  const {
    requireAdminMode = true,
    redirectTo = 'Home',
    message = "You don't have access to that area."
  } = options;

  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  // Determine if access is allowed
  const isLoading = !context;
  
  let isAllowed = false;
  if (context) {
    const hasPermission = context.permissions?.[permissionKey] === true;
    const inAdminMode = !requireAdminMode || context.actingMode === 'admin';
    isAllowed = hasPermission && inAdminMode;
  }

  useEffect(() => {
    if (!isLoading && !isAllowed && !hasRedirected) {
      setHasRedirected(true);
      toast.error(message);
      navigate(createPageUrl(redirectTo), { replace: true });
    }
  }, [isLoading, isAllowed, hasRedirected, message, navigate, redirectTo]);

  return { isAllowed, isLoading };
}

/**
 * Wrapper component for permission-protected pages
 */
export function RequirePermission({ 
  context, 
  permissionKey, 
  requireAdminMode = true,
  redirectTo = 'Home',
  message = "You don't have access to that area.",
  loadingComponent = null,
  children 
}) {
  const { isAllowed, isLoading } = useRequirePermission(context, permissionKey, {
    requireAdminMode,
    redirectTo,
    message
  });

  if (isLoading) {
    return loadingComponent;
  }

  if (!isAllowed) {
    return null; // Will redirect
  }

  return children;
}