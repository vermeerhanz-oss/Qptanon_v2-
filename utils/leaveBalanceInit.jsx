import { base44 } from '@/api/base44Client';

const EmployeeLeaveBalance = base44.entities.EmployeeLeaveBalance;

/**
 * Initialize leave balance records for a new employee.
 * Creates annual and personal leave balance records with 0 hours.
 * 
 * @param {string} employeeId - The employee ID
 * @param {string} startDate - The employee's start date (optional, defaults to today)
 */
export async function initializeLeaveBalances(employeeId, startDate = null) {
  const today = startDate || new Date().toISOString().split('T')[0];
  
  // Check if balances already exist
  const existing = await EmployeeLeaveBalance.filter({ employee_id: employeeId });
  
  const existingTypes = new Set(existing.map(b => b.leave_type));
  const leaveTypes = ['annual', 'personal'];
  
  const toCreate = [];
  
  for (const leaveType of leaveTypes) {
    if (!existingTypes.has(leaveType)) {
      toCreate.push({
        employee_id: employeeId,
        leave_type: leaveType,
        balance_hours: 0,
        last_calculated_date: today,
      });
    }
  }
  
  if (toCreate.length > 0) {
    await EmployeeLeaveBalance.bulkCreate(toCreate);
  }
  
  return toCreate.length;
}

/**
 * Get leave balances for an employee
 * 
 * @param {string} employeeId - The employee ID
 * @returns {Promise<Object>} Map of leave_type -> balance record
 */
export async function getLeaveBalances(employeeId) {
  const balances = await EmployeeLeaveBalance.filter({ employee_id: employeeId });
  
  const balanceMap = {};
  for (const balance of balances) {
    balanceMap[balance.leave_type] = balance;
  }
  
  return balanceMap;
}