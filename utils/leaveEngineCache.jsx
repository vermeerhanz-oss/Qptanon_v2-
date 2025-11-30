/**
 * Leave Engine Cache
 * 
 * Provides cache invalidation and a global version counter for leave data.
 * Components can subscribe to the version to trigger re-fetches.
 */

// Simple in-memory cache version
let _cacheVersion = 0;
let _listeners = [];

/**
 * Get the current cache version.
 * Components can use this to trigger re-fetches when it changes.
 */
export function getLeaveEngineCacheVersion() {
  return _cacheVersion;
}

/**
 * Invalidate the leave cache for a specific employee or globally.
 * This bumps the cache version and notifies all listeners.
 * 
 * @param {string} [employeeId] - Optional employee ID (currently unused, for future per-employee caching)
 */
export function invalidateLeaveCache(employeeId = null) {
  _cacheVersion++;
  console.log('[leaveEngineCache] Cache invalidated, new version:', _cacheVersion, employeeId ? `for employee ${employeeId}` : 'global');
  
  // Notify all listeners
  _listeners.forEach(listener => {
    try {
      listener(_cacheVersion, employeeId);
    } catch (err) {
      console.error('[leaveEngineCache] Listener error:', err);
    }
  });
}

/**
 * Subscribe to cache invalidation events.
 * 
 * @param {Function} listener - Callback function(version, employeeId)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLeaveCache(listener) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter(l => l !== listener);
  };
}

/**
 * React hook for subscribing to leave cache version.
 * Returns the current version - components can use this in useEffect deps.
 */
export function useLeaveEngineCacheVersion() {
  // This is a simple implementation - for React we'd use useSyncExternalStore
  // For now, components should call getLeaveEngineCacheVersion() directly
  return _cacheVersion;
}