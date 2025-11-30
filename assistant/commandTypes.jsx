/**
 * AI Assistant Command Types
 * 
 * This module defines the canonical command schema for the HRIS AI Assistant.
 * Commands are structured, validated, and can be executed independently of any LLM.
 */

/**
 * @typedef {'create_entity' | 'add_employee' | 'change_reporting_line'} AssistantCommandType
 */

/**
 * @typedef {Object} CreateEntityPayload
 * @property {string} name - Legal entity name
 * @property {string} country - Country of incorporation
 * @property {string} [abbreviation] - Short code (e.g. "ACME-UK")
 * @property {string} [timezone] - Timezone (e.g. "Europe/London")
 */

/**
 * @typedef {Object} AddEmployeePayload
 * @property {string} first_name - Employee first name
 * @property {string} last_name - Employee last name
 * @property {string} work_email - Work email address
 * @property {string} role_title - Job title
 * @property {string} department - Department name
 * @property {string} [entity_name] - Entity name (e.g. "ACME UK")
 * @property {string} [manager_email] - Manager's email to attach to
 * @property {string} [location_name] - Location name (e.g. "London")
 * @property {'full_time' | 'part_time' | 'contractor' | 'casual'} [employment_type] - Employment type
 * @property {string} [start_date] - ISO date string (YYYY-MM-DD)
 */

/**
 * @typedef {Object} ChangeReportingLinePayload
 * @property {string} employee_email - Email of employee to update
 * @property {string} new_manager_email - Email of new manager
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success - Whether command executed successfully
 * @property {string} [message] - Human-readable result message
 * @property {Object} [data] - Any returned data (e.g. created record)
 * @property {string} [error] - Error message if failed
 */

/**
 * Command type constants
 */
export const COMMAND_TYPES = {
  CREATE_ENTITY: 'create_entity',
  ADD_EMPLOYEE: 'add_employee',
  CHANGE_REPORTING_LINE: 'change_reporting_line',
};

/**
 * Payload schemas for validation
 */
export const PAYLOAD_SCHEMAS = {
  create_entity: {
    required: ['name', 'country'],
    optional: ['abbreviation', 'timezone'],
  },
  add_employee: {
    required: ['first_name', 'last_name', 'work_email', 'role_title', 'department'],
    optional: ['entity_name', 'manager_email', 'location_name', 'employment_type', 'start_date'],
  },
  change_reporting_line: {
    required: ['employee_email', 'new_manager_email'],
    optional: [],
  },
};

/**
 * Validate a command payload against its schema
 * @param {AssistantCommandType} type 
 * @param {Object} payload 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCommandPayload(type, payload) {
  const schema = PAYLOAD_SCHEMAS[type];
  if (!schema) {
    return { valid: false, errors: [`Unknown command type: ${type}`] };
  }

  const errors = [];
  
  // Check required fields
  for (const field of schema.required) {
    if (!payload[field] || (typeof payload[field] === 'string' && !payload[field].trim())) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate email format for email fields
  const emailFields = ['work_email', 'employee_email', 'new_manager_email', 'manager_email'];
  for (const field of emailFields) {
    if (payload[field] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload[field])) {
      errors.push(`Invalid email format: ${field}`);
    }
  }

  // Validate employment_type enum
  if (payload.employment_type) {
    const validTypes = ['full_time', 'part_time', 'contractor', 'casual'];
    if (!validTypes.includes(payload.employment_type)) {
      errors.push(`Invalid employment_type: ${payload.employment_type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  // Validate date format
  if (payload.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.start_date)) {
    errors.push(`Invalid start_date format: ${payload.start_date}. Expected YYYY-MM-DD`);
  }

  return { valid: errors.length === 0, errors };
}