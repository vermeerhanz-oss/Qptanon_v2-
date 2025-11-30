import { format, parseISO } from 'date-fns';

/**
 * Date Formatting Utilities
 * 
 * Centralized date formatting based on user preferences.
 */

// Default preferences
const DEFAULT_PREFERENCES = {
  date_format: 'DD/MM/YYYY',
  timezone: 'Australia/Sydney',
  language: 'en-AU'
};

// Convert our format strings to date-fns format
const FORMAT_MAP = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy'
};

/**
 * Format a date according to user preferences
 * @param {string|Date} date - Date to format
 * @param {Object} preferences - User preferences object
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
export function formatDate(date, preferences = {}, includeTime = false) {
  if (!date) return '—';
  
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (isNaN(dateObj.getTime())) return '—';
  
  const dateFormat = FORMAT_MAP[prefs.date_format] || 'dd/MM/yyyy';
  const fullFormat = includeTime ? `${dateFormat} HH:mm` : dateFormat;
  
  return format(dateObj, fullFormat);
}

/**
 * Format a date with time
 * @param {string|Date} date - Date to format
 * @param {Object} preferences - User preferences object
 * @returns {string} Formatted date-time string
 */
export function formatDateTime(date, preferences = {}) {
  return formatDate(date, preferences, true);
}

/**
 * Format a date in a short format (e.g., "12 Jan")
 * @param {string|Date} date - Date to format
 * @returns {string} Short formatted date
 */
export function formatDateShort(date) {
  if (!date) return '—';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(dateObj.getTime())) return '—';
  return format(dateObj, 'd MMM');
}

/**
 * Format a date in a long format (e.g., "12 January 2024")
 * @param {string|Date} date - Date to format
 * @returns {string} Long formatted date
 */
export function formatDateLong(date) {
  if (!date) return '—';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(dateObj.getTime())) return '—';
  return format(dateObj, 'd MMMM yyyy');
}

// Common timezone list
export const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST/ACDT)' },
  { value: 'Australia/Darwin', label: 'Australia/Darwin (ACST)' },
  { value: 'Australia/Hobart', label: 'Australia/Hobart (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
  { value: 'Pacific/Fiji', label: 'Pacific/Fiji (FJT)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (HKT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' }
];

// Language options
export const LANGUAGES = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' }
];

// Date format options
export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '26/11/2025' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '11/26/2025' }
];