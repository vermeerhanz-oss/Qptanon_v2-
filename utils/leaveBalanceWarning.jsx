/**
 * Leave Balance Warning Utility
 * 
 * Calculates whether a leave request would exceed available balance
 * and provides formatted warning messages.
 */

import { safeNumber, formatHours } from './numberUtils';

/**
 * Get the hours per day for an employee.
 * Priority:
 * 1. Policy standard_hours_per_day
 * 2. Employee hours_per_week / 5
 * 3. Default 7.6 hours
 * 
 * @param {Object} employee - Employee record
 * @param {Object} policy - Leave policy record
 * @returns {number} Hours per day (always finite, minimum 1)
 */
export function getHoursPerDay(employee, policy) {
  // Try policy first
  if (policy?.standard_hours_per_day && Number.isFinite(policy.standard_hours_per_day)) {
    return policy.standard_hours_per_day;
  }
  
  // Try employee hours_per_week
  if (employee?.hours_per_week && Number.isFinite(employee.hours_per_week)) {
    return employee.hours_per_week / 5;
  }
  
  // Default fallback
  return 7.6;
}

/**
 * Calculate needed hours for a leave request.
 * 
 * @param {number} chargeableDays - Number of chargeable business days
 * @param {Object} employee - Employee record
 * @param {Object} policy - Leave policy record
 * @returns {number} Hours needed (always finite, >= 0)
 */
export function calculateNeededHours(chargeableDays, employee, policy) {
  const safeDays = safeNumber(chargeableDays, 0);
  const hoursPerDay = getHoursPerDay(employee, policy);
  return safeNumber(safeDays * hoursPerDay, 0);
}

/**
 * Get available hours from a balance object.
 * Handles both leaveContext.balances format (available_hours) 
 * and getBalancesForEmployee format (availableHours).
 * 
 * @param {Object} balance - Balance object from either source
 * @returns {number} Available hours (always finite, >= 0)
 */
export function getAvailableHours(balance) {
  if (!balance) return 0;
  
  // Try both property names
  const hours = balance.available_hours ?? balance.availableHours ?? 0;
  return safeNumber(hours, 0);
}

/**
 * Check if a leave request would exceed available balance.
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.balance - Leave balance object
 * @param {number} params.chargeableDays - Number of chargeable days
 * @param {Object} params.employee - Employee record
 * @param {Object} params.policy - Leave policy record (optional)
 * @returns {{ isInsufficient: boolean, availableHours: number, neededHours: number, hoursPerDay: number }}
 */
export function checkLeaveBalance({ balance, chargeableDays, employee, policy }) {
  const availableHours = getAvailableHours(balance);
  const hoursPerDay = getHoursPerDay(employee, policy);
  const neededHours = calculateNeededHours(chargeableDays, employee, policy);
  
  // Small epsilon tolerance (0.01 hours) to avoid floating point issues
  const isInsufficient = neededHours > availableHours + 0.01;
  
  return {
    isInsufficient,
    availableHours,
    neededHours,
    hoursPerDay,
  };
}

/**
 * Generate a warning message for insufficient leave balance.
 * 
 * @param {Object} params - Parameters from checkLeaveBalance
 * @returns {string} Formatted warning message
 */
export function formatBalanceWarning({ availableHours, neededHours }) {
  return `Insufficient leave balance. You have ${formatHours(availableHours)} hours available but need ${formatHours(neededHours)} hours.`;
}