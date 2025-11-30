import { base44 } from '@/api/base44Client';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  getServiceStartDate,
  getApplicablePolicyForEmployee,
  calculateAccrualForPeriod,
  calculateLSLAccrual,
} from './leaveAccrual';
import { calculateChargeableLeave } from './LeaveEngine';
import { safeNumber } from './numberUtils';

const Employee = base44.entities.Employee;
const LeaveRequest = base44.entities.LeaveRequest;
const LeaveType = base44.entities.LeaveType;
const LeaveBalance = base44.entities.LeaveBalance;

/**
 * Leave Balance Service
 *
 * Single source of truth for computing leave balances per employee.
 * Used by dashboard tiles, My Leave page, and any other leave balance views.
 *
 * This service is side-effect free - it only computes and returns balances.
 * It does NOT write to the database.
 */

/**
 * Map a leave type ID to a balance category ('annual', 'personal', 'long_service')
 *
 * @param {string} leaveTypeId - The leave type ID
 * @param {Array} allLeaveTypes - All leave types (optional, will be fetched if not provided)
 * @returns {Promise<string>} The balance category
 */
async function getBalanceCategory(leaveTypeId, allLeaveTypes = null) {
  if (!allLeaveTypes) {
    allLeaveTypes = await LeaveType.list();
  }

  const leaveType = allLeaveTypes.find((lt) => lt.id === leaveTypeId);
  if (!leaveType) return 'annual';

  const code = (leaveType.code || leaveType.name || '').toLowerCase();

  if (code.includes('personal') || code.includes('sick') || code.includes('carer')) {
    return 'personal';
  }
  if (code.includes('long') || code.includes('lsl')) {
    return 'long_service';
  }
  return 'annual';
}

/**
 * Calculate used leave hours for an employee and leave type category.
 * Includes APPROVED and PENDING requests (pending = reserved).
 *
 * @param {string} employeeId - The employee ID
 * @param {string} category - 'annual', 'personal', or 'long_service'
 * @param {Object} employee - Employee object (for hours calculation)
 * @param {Object} policy - Policy object (for standard_hours_per_day)
 * @param {Array} allLeaveTypes - All leave types
 * @returns {Promise<{approved: number, pending: number, total: number}>} Used hours breakdown
 */
async function calculateUsedLeaveHours(
  employeeId,
  category,
  employee,
  policy,
  allLeaveTypes
) {
  // Get all leave requests for this employee
  const allRequests = await LeaveRequest.filter({ employee_id: employeeId });

  // Filter to approved and pending
  const relevantRequests = allRequests.filter(
    (r) => r.status === 'approved' || r.status === 'pending'
  );

  // Derive hoursPerDay
  let hoursPerDay;
  if (
    Number.isFinite(policy?.standard_hours_per_day) &&
    policy.standard_hours_per_day > 0
  ) {
    hoursPerDay = policy.standard_hours_per_day;
  } else if (
    Number.isFinite(employee?.hours_per_week) &&
    employee.hours_per_week > 0
  ) {
    hoursPerDay = employee.hours_per_week / 5;
  } else {
    hoursPerDay = 7.6;
  }

  let approvedHours = 0;
  let pendingHours = 0;

  for (const req of relevantRequests) {
    // Check if this request belongs to this category
    const reqCategory = await getBalanceCategory(req.leave_type_id, allLeaveTypes);
    if (reqCategory !== category) continue;

    // Use total_days from request (which already includes half-day adjustments)
    // or calculate chargeable days if missing
    let chargeableDays = req.total_days;
    if (!chargeableDays || chargeableDays <= 0) {
      const breakdown = await calculateChargeableLeave({
        start_date: req.start_date,
        end_date: req.end_date,
        employee_id: employeeId,
        partial_day_type: req.partial_day_type || 'full',
      });
      chargeableDays = breakdown.chargeableDays || 0;
    }

    const hours = chargeableDays * hoursPerDay;

    if (req.status === 'approved') {
      approvedHours += hours;
    } else {
      pendingHours += hours;
    }
  }

  return {
    approved: Math.round(approvedHours * 100) / 100,
    pending: Math.round(pendingHours * 100) / 100,
    total: Math.round((approvedHours + pendingHours) * 100) / 100,
  };
}

/**
 * Calculate accrued leave hours for an employee and leave type.
 * Computes from employment_start_date (service_start_date) to asOfDate.
 *
 * @param {Object} employee - Employee object
 * @param {string} leaveType - 'annual', 'personal', or 'long_service'
 * @param {Object} policy - Applicable leave policy
 * @param {Date} asOfDate - Date to calculate up to
 * @returns {Promise<{accrued: number, eligible: boolean, message?: string}>}
 */
async function calculateAccruedHours(employee, leaveType, policy, asOfDate) {
  if (!policy) {
    return { accrued: 0, eligible: false, message: 'No applicable policy' };
  }

  const serviceStartDate = getServiceStartDate(employee);
  if (!serviceStartDate) {
    return { accrued: 0, eligible: false, message: 'No employment start date set' };
  }

  const startDate = parseISO(serviceStartDate);
  const daysSinceStart = differenceInDays(asOfDate, startDate);

  if (daysSinceStart <= 0) {
    return { accrued: 0, eligible: true, message: 'Employment not yet started' };
  }

  // Special handling for Long Service Leave
  if (leaveType === 'long_service' && policy.min_service_years_before_accrual) {
    const lslResult = calculateLSLAccrual(policy, employee, asOfDate, startDate);

    if (!lslResult.eligible) {
      return {
        accrued: 0,
        eligible: false,
        yearsOfService: lslResult.yearsOfService,
        eligibilityDate: lslResult.eligibilityDate,
        message: lslResult.message,
      };
    }

    return {
      accrued: Math.round(lslResult.accruedHours * 100) / 100,
      eligible: true,
      yearsOfService: lslResult.yearsOfService,
    };
  }

  // Standard accrual calculation with pro-rata for part-time
  const accruedHours = calculateAccrualForPeriod(
    policy,
    daysSinceStart,
    null,
    employee
  );

  return {
    accrued: Math.round(accruedHours * 100) / 100,
    eligible: true,
    daysOfService: daysSinceStart,
  };
}

/**
 * Get leave balances for an employee.
 *
 * This is the main entry point for computing leave balances.
 * Side-effect free - only computes and returns balances.
 *
 * @param {string} employeeId - The employee ID
 * @param {Date|string} asOfDate - Date to calculate up to (default: today)
 * @returns {Promise<Object>} Balance object with annual, personal, long_service
 */
export async function getLeaveBalancesForEmployee(
  employeeId,
  asOfDate = new Date()
) {
  const asOfDateParsed =
    typeof asOfDate === 'string' ? parseISO(asOfDate) : asOfDate;

  // Load employee
  const employees = await Employee.filter({ id: employeeId });
  if (employees.length === 0) {
    return { error: 'Employee not found' };
  }
  const employee = employees[0];

  // Load all leave types for category mapping
  const allLeaveTypes = await LeaveType.list();

  // Load existing balance records for opening/adjusted values
  const existingBalances = await LeaveBalance.filter({ employee_id: employeeId });

  const categories = ['annual', 'personal', 'long_service'];
  const result = {};

  for (const category of categories) {
    // Get applicable policy
    const policy = await getApplicablePolicyForEmployee(
      employeeId,
      category,
      employee
    );

    // Calculate accrued from employment_start_date
    const accrualResult = await calculateAccruedHours(
      employee,
      category,
      policy,
      asOfDateParsed
    );

    // Calculate used (approved + pending)
    const usedResult = await calculateUsedLeaveHours(
      employeeId,
      category,
      employee,
      policy,
      allLeaveTypes
    );

    // Get opening/adjusted from stored balance (if exists)
    const storedBalance = existingBalances.find(
      (b) => b.leave_type === category
    );
    const openingHours = safeNumber(storedBalance?.opening_balance_hours, 0);
    const adjustedHours = safeNumber(storedBalance?.adjusted_hours, 0);

    // Calculate available = accrued + opening + adjusted - used
    // Never return negative
    const totalEntitlement =
      accrualResult.accrued + openingHours + adjustedHours;
    const available = Math.max(0, totalEntitlement - usedResult.total);
    const roundedAvailable = Math.round(available * 100) / 100;

    result[category] = {
      accrued: accrualResult.accrued,
      openingBalance: openingHours,
      adjusted: adjustedHours,
      totalEntitlement: Math.round(totalEntitlement * 100) / 100,
      used: usedResult.total,
      usedApproved: usedResult.approved,
      usedPending: usedResult.pending,
      // main field
      available: roundedAvailable,
      // alias for any consumers expecting `availableHours`
      availableHours: roundedAvailable,
      eligible: accrualResult.eligible,
      message: accrualResult.message,
      yearsOfService: accrualResult.yearsOfService,
      eligibilityDate: accrualResult.eligibilityDate,
      daysOfService: accrualResult.daysOfService,
      standardHoursPerDay: policy?.standard_hours_per_day || 7.6,
      policyName: policy?.name || null,
    };
  }

  // Add metadata
  result.employeeId = employeeId;
  result.asOfDate = format(asOfDateParsed, 'yyyy-MM-dd');
  result.employmentStartDate = getServiceStartDate(employee);

  return result;
}

/**
 * Get leave balance for the current user.
 * Convenience wrapper that determines the employee from the current user.
 *
 * @param {Date|string} asOfDate - Date to calculate up to (default: today)
 * @returns {Promise<Object>} Balance object
 */
export async function getMyLeaveBalances(asOfDate = new Date()) {
  const user = await base44.auth.me();

  // Find employee by email or user_id
  const employees = await Employee.list();
  const employee = employees.find(
    (e) => e.email === user.email || e.user_id === user.id
  );

  if (!employee) {
    return { error: 'No employee profile linked to current user' };
  }

  return await getLeaveBalancesForEmployee(employee.id, asOfDate);
}

/**
 * Convert balance hours to days using standard hours per day.
 *
 * @param {number} hours - Hours to convert
 * @param {number} standardHoursPerDay - Standard hours per day (default 7.6)
 * @returns {number} Days
 */
export function balanceHoursToDays(hours, standardHoursPerDay = 7.6) {
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeStd =
    Number.isFinite(standardHoursPerDay) && standardHoursPerDay > 0
      ? standardHoursPerDay
      : 7.6;
  return Math.round((safeHours / safeStd) * 100) / 100;
}
