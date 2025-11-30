/**
 * Numeric formatting utilities
 * 
 * Use these helpers to safely format numbers for display,
 * avoiding "Cannot read properties of undefined (reading 'toFixed')" errors.
 */

/**
 * Safely convert a value to a finite number
 * @param {*} value - The value to convert
 * @param {number} defaultValue - Default value if conversion fails (default: 0)
 * @returns {number} A finite number
 */
export function safeNumber(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * Format a number with fixed decimal places, safely handling undefined/NaN
 * @param {*} value - The value to format
 * @param {number} fractionDigits - Number of decimal places (default: 1)
 * @returns {string} Formatted number string
 */
export function formatNumber(value, fractionDigits = 1) {
  const n = safeNumber(value, 0);
  return n.toFixed(fractionDigits);
}

/**
 * Format days for display (alias for formatNumber with 1 decimal)
 * @param {*} value - The value to format
 * @param {number} fractionDigits - Number of decimal places (default: 1)
 * @returns {string} Formatted days string
 */
export function formatDays(value, fractionDigits = 1) {
  return formatNumber(value, fractionDigits);
}

/**
 * Format hours for display (alias for formatNumber with 1 decimal)
 * @param {*} value - The value to format
 * @param {number} fractionDigits - Number of decimal places (default: 1)
 * @returns {string} Formatted hours string
 */
export function formatHours(value, fractionDigits = 1) {
  return formatNumber(value, fractionDigits);
}

/**
 * Format currency for display
 * @param {*} value - The value to format
 * @param {number} fractionDigits - Number of decimal places (default: 2)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, fractionDigits = 2) {
  return formatNumber(value, fractionDigits);
}

/**
 * Format percentage for display
 * @param {*} value - The value to format (0-100 scale)
 * @param {number} fractionDigits - Number of decimal places (default: 0)
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, fractionDigits = 0) {
  return formatNumber(value, fractionDigits);
}