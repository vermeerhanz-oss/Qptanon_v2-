import { base44 } from '@/api/base44Client';

const Employee = base44.entities.Employee;

/**
 * Get the Employee record for the current user.
 * Matches by email (user.email === employee.email) or user_id relation.
 * 
 * @param {Object} user - The current user object from base44.auth.me()
 * @returns {Promise<Object|null>} - The Employee record or null if not found
 */
export async function getCurrentEmployeeForUser(user) {
  if (!user) return null;
  
  try {
    // First try to find by user_id relation
    if (user.id) {
      const byUserId = await Employee.filter({ user_id: user.id });
      if (byUserId.length === 1) {
        return byUserId[0];
      }
    }
    
    // Fall back to email matching
    if (user.email) {
      const byEmail = await Employee.filter({ email: user.email });
      if (byEmail.length === 1) {
        return byEmail[0];
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding employee for user:', error);
    return null;
  }
}

/**
 * Get the manager for a leave request based on the employee.
 * 
 * @param {Object} employee - The employee record
 * @returns {string|null} - The manager's employee ID or null
 */
export function getManagerForLeaveRequest(employee) {
  return employee?.manager_id || null;
}

/**
 * Core fields to return for employee queries used in leave UI.
 */
const EMPLOYEE_CORE_FIELDS = [
  'id',
  'first_name',
  'last_name',
  'preferred_name',
  'email',
  'employment_type',
  'job_title',
  'department_id',
  'manager_id',
  'status',
  'hours_per_week',
  'service_start_date',
  'start_date',
];

/**
 * Pick only core fields from an employee record.
 * 
 * @param {Object} employee - Full employee record
 * @returns {Object} - Employee with only core fields
 */
function pickCoreFields(employee) {
  if (!employee) return null;
  const result = {};
  for (const field of EMPLOYEE_CORE_FIELDS) {
    if (employee[field] !== undefined) {
      result[field] = employee[field];
    }
  }
  return result;
}

/**
 * Get all active employees who report directly to a given manager.
 * Returns only core fields needed for the leave UI.
 * 
 * @param {string} managerId - The manager's employee ID
 * @returns {Promise<Array>} - Array of employee records (core fields only)
 */
export async function getDirectReportsForManager(managerId) {
  if (!managerId) return [];
  
  try {
    const allEmployees = await Employee.filter({ manager_id: managerId });
    
    // Filter to active employees only and pick core fields
    return allEmployees
      .filter(emp => emp.status === 'active' || emp.status === 'onboarding')
      .map(pickCoreFields);
  } catch (error) {
    console.error('Error fetching direct reports:', error);
    return [];
  }
}

/**
 * Get all active employees for admin users.
 * Returns only core fields needed for the leave UI.
 * 
 * @returns {Promise<Array>} - Array of all active employee records (core fields only)
 */
export async function getAllEmployeesForAdmin() {
  try {
    const allEmployees = await Employee.list();
    
    // Filter to active employees only and pick core fields
    return allEmployees
      .filter(emp => emp.status === 'active' || emp.status === 'onboarding')
      .map(pickCoreFields);
  } catch (error) {
    console.error('Error fetching all employees:', error);
    return [];
  }
}