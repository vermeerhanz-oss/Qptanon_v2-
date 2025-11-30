/**
 * Setup Helpers
 * 
 * Utility functions to determine if tenant setup is complete.
 */

import { base44 } from '@/api/base44Client';

/**
 * Check if at least one Company exists (tenant is configured)
 * @returns {Promise<boolean>}
 */
export async function isTenantConfigured() {
  const companies = await base44.entities.Company.list();
  return companies.length > 0;
}

/**
 * Check if the current user has an Employee profile linked
 * @param {Object} currentUser - The authenticated user object
 * @returns {Promise<boolean>}
 */
export async function hasEmployeeProfile(currentUser) {
  if (!currentUser?.id) return false;
  
  // Check by user_id first (primary link)
  let employees = await base44.entities.Employee.filter({ user_id: currentUser.id });
  if (employees.length > 0) return true;
  
  // Fallback: check by email
  if (currentUser.email) {
    employees = await base44.entities.Employee.filter({ email: currentUser.email });
    return employees.length > 0;
  }
  
  return false;
}

/**
 * Get the current user's employee record
 * @param {Object} currentUser - The authenticated user object
 * @returns {Promise<Object|null>}
 */
export async function getEmployeeForUser(currentUser) {
  if (!currentUser?.id) return null;
  
  // Check by user_id first
  let employees = await base44.entities.Employee.filter({ user_id: currentUser.id });
  if (employees.length > 0) return employees[0];
  
  // Fallback: check by email
  if (currentUser.email) {
    employees = await base44.entities.Employee.filter({ email: currentUser.email });
    if (employees.length > 0) return employees[0];
  }
  
  return null;
}