import { base44 } from '@/api/base44Client';
import { NotificationCategory, shouldSendEmail } from './notificationHelpers';
import {
  canActAsAdmin,
  canCreateLeaveRequest,
  canApproveLeave,
  canCancelLeaveRequest,
} from './permissions';
import {
  calculateChargeableLeave,
  applyApprovedLeave,
  revertLeave,
} from './LeaveEngine';
import { safeNumber, formatHours } from './numberUtils';
import { sendNotification } from './notifications';
import { logForCurrentUser } from './audit';
import { invalidateLeaveCache } from './leaveEngineCache';

const LeaveBalance = base44.entities.LeaveBalance;
const EmployeeLeaveBalance = base44.entities.EmployeeLeaveBalance;
const LeavePolicy = base44.entities.LeavePolicy;
const LeaveType = base44.entities.LeaveType;
const UserPreferences = base44.entities.UserPreferences;
const LeaveRequest = base44.entities.LeaveRequest;

/**
 * Paid leave types that casual employees cannot access.
 * These codes/names are matched case-insensitively.
 */
const PAID_LEAVE_TYPES = ['annual', 'personal', 'sick'];

/**
 * Check if two date ranges overlap.
 * Ranges [from1, to1] and [from2, to2] overlap if: from1 <= to2 AND to1 >= from2
 */
function dateRangesOverlap(from1, to1, from2, to2) {
  return from1 <= to2 && to1 >= from2;
}

/**
 * Check for overlapping leave requests for an employee.
 * Returns any pending or approved requests that overlap the given date range.
 *
 * @param {string} employeeId - The employee ID
 * @param {string} startDate - Start date (yyyy-MM-dd)
 * @param {string} endDate - End date (yyyy-MM-dd)
 * @returns {Promise<Array>} Overlapping leave requests
 */
async function findOverlappingLeaveRequests(employeeId, startDate, endDate) {
  // Get all pending or approved requests for this employee
  const allRequests = await LeaveRequest.filter({ employee_id: employeeId });

  // Filter to pending/approved and overlapping dates
  const overlapping = allRequests.filter((req) => {
    if (req.status !== 'pending' && req.status !== 'approved') {
      return false;
    }
    return dateRangesOverlap(startDate, endDate, req.start_date, req.end_date);
  });

  return overlapping;
}

/**
 * Check if a leave type is a paid leave type (blocked for casuals).
 *
 * @param {string} leaveTypeId - The leave type ID
 * @returns {Promise<boolean>} True if this is a paid leave type
 */
async function isPaidLeaveType(leaveTypeId) {
  const leaveTypes = await LeaveType.filter({ id: leaveTypeId });
  if (leaveTypes.length === 0) return false;

  const leaveType = leaveTypes[0];
  const code = (leaveType.code || leaveType.name || '').toLowerCase();

  return PAID_LEAVE_TYPES.some((paidType) => code.includes(paidType));
}

/**
 * Map leave type ID to balance leave_type ('annual' or 'personal')
 */
async function getBalanceLeaveType(leaveTypeId) {
  const leaveTypes = await LeaveType.filter({ id: leaveTypeId });
  if (leaveTypes.length === 0) return 'annual';

  const leaveType = leaveTypes[0];
  const code = (leaveType.code || leaveType.name || '').toLowerCase();

  if (code.includes('personal') || code.includes('sick')) {
    return 'personal';
  }
  return 'annual';
}

/**
 * Deduct leave hours from an employee's EmployeeLeaveBalance.
 * This is called when a leave request is approved.
 *
 * @param {string} employeeId - The employee's ID
 * @param {string} leaveTypeId - The leave type ID
 * @param {number} hours - Number of hours to deduct
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deductLeaveBalance(employeeId, leaveTypeId, hours) {
  try {
    const leaveType = await getBalanceLeaveType(leaveTypeId);

    const balances = await EmployeeLeaveBalance.filter({
      employee_id: employeeId,
      leave_type: leaveType,
    });

    if (balances.length === 0) {
      console.warn(
        `No leave balance found for employee ${employeeId}, leave type ${leaveType}`,
      );
      return { success: true };
    }

    const balance = balances[0];
    const newBalanceHours = (balance.balance_hours || 0) - hours;

    await EmployeeLeaveBalance.update(balance.id, {
      balance_hours: newBalanceHours,
      last_calculated_date: new Date().toISOString().split('T')[0],
    });

    return { success: true };
  } catch (error) {
    console.error('Error deducting leave balance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore leave hours to an employee's EmployeeLeaveBalance.
 * This is called when a leave request is cancelled.
 *
 * @param {string} employeeId - The employee's ID
 * @param {string} leaveTypeId - The leave type ID
 * @param {number} hours - Number of hours to restore
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function restoreLeaveBalance(employeeId, leaveTypeId, hours) {
  try {
    const leaveType = await getBalanceLeaveType(leaveTypeId);

    const balances = await EmployeeLeaveBalance.filter({
      employee_id: employeeId,
      leave_type: leaveType,
    });

    if (balances.length === 0) {
      console.warn(
        `No leave balance found for employee ${employeeId}, leave type ${leaveType}`,
      );
      return { success: true };
    }

    const balance = balances[0];
    const newBalanceHours = (balance.balance_hours || 0) + hours;

    await EmployeeLeaveBalance.update(balance.id, {
      balance_hours: newBalanceHours,
      last_calculated_date: new Date().toISOString().split('T')[0],
    });

    return { success: true };
  } catch (error) {
    console.error('Error restoring leave balance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if employee has sufficient leave balance
 *
 * Uses the same logic as the front-end:
 * - Derives hoursPerDay from policy.standard_hours_per_day, employee.hours_per_week/5, or default 7.6
 * - Computes neededHours = chargeableDays * hoursPerDay
 * - Compares with small epsilon tolerance (0.01)
 *
 * @param {string} employeeId - The employee's ID
 * @param {string} leaveTypeId - The leave type ID
 * @param {number} chargeableDays - Number of chargeable business days
 * @param {Object} employee - Employee object (for hours_per_week)
 * @returns {Promise<{sufficient: boolean, available: number, needed: number, hoursPerDay: number, allowNegative: boolean}>}
 */
export async function checkLeaveBalance(
  employeeId,
  leaveTypeId,
  chargeableDays,
  employee = null,
) {
  const leaveType = await getBalanceLeaveType(leaveTypeId);

  // Get balance
  const balances = await EmployeeLeaveBalance.filter({
    employee_id: employeeId,
    leave_type: leaveType,
  });

  const available =
    balances.length > 0 ? safeNumber(balances[0].balance_hours, 0) : 0;

  // Get policy to check allow_negative_balance and standard_hours_per_day
  const policies = await LeavePolicy.filter({
    leave_type: leaveType,
    is_default: true,
    is_active: true,
  });

  const policy = policies.length > 0 ? policies[0] : null;
  const allowNegative = policy?.allow_negative_balance || false;

  // Derive hoursPerDay using same logic as front-end
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

  // Calculate needed hours
  const days = safeNumber(chargeableDays, 0);
  const neededHours = days * hoursPerDay;

  // Use epsilon tolerance for comparison (same as front-end)
  const EPS = 0.01;
  const sufficient = neededHours <= available + EPS || allowNegative;

  return {
    sufficient,
    available,
    needed: neededHours,
    hoursPerDay,
    allowNegative,
  };
}

/**
 * Create a leave request with proper status based on whether employee has a manager.
 * Auto-approves and deducts balance if no manager is assigned.
 *
 * Validates sufficient balance before creating (unless allow_negative_balance=true).
 * Supports half-day leave (AM/PM) for single-day requests.
 *
 * @param {Object} params
 * @param {Object} params.employee - The target employee object
 * @param {string} params.leaveTypeId - Leave type ID
 * @param {string} params.startDate - Start date
 * @param {string} params.endDate - End date
 * @param {string} [params.reason] - Optional reason
 * @param {string} [params.partialDayType] - 'full', 'half_am', or 'half_pm' (default: 'full')
 * @param {Object} [params.currentUser] - Current user (for permission check)
 * @param {Object} [params.currentEmployee] - Current user's employee record
 * @param {Object} [params.preferences] - User preferences with acting_mode
 * @returns {Promise<{success: boolean, autoApproved: boolean, hoursDeducted?: number, error?: string}>}
 */
export async function createLeaveRequest(params) {
  const {
    employee,
    leaveTypeId,
    startDate,
    endDate,
    reason,
    partialDayType = 'full',
    currentUser,
    currentEmployee,
    preferences,
  } = params;

  // Permission check: if user/preferences provided, validate permission
  if (currentUser && preferences) {
    if (
      !canCreateLeaveRequest(
        currentUser,
        employee,
        currentEmployee,
        preferences,
      )
    ) {
      return {
        success: false,
        autoApproved: false,
        error: 'PERMISSION_DENIED',
        message: 'In staff mode, you can only create leave requests for yourself.',
      };
    }
  }

  // =====================================================
  // 0) Half-day validation - must be single day
  // =====================================================
  const isHalfDay =
    partialDayType === 'half_am' || partialDayType === 'half_pm';
  if (isHalfDay && startDate !== endDate) {
    return {
      success: false,
      autoApproved: false,
      error: 'HALF_DAY_MUST_BE_SINGLE_DAY',
      message:
        'Half-day leave is only available for single-day requests. Please make the start and end date the same or choose Full day.',
    };
  }

  // =====================================================
  // 1) Casual employee guard - block paid leave types
  // =====================================================
  const employmentType = employee.employment_type || 'full_time';

  if (employmentType === 'casual') {
    const isPaid = await isPaidLeaveType(leaveTypeId);
    if (isPaid) {
      return {
        success: false,
        autoApproved: false,
        error: 'PAID_LEAVE_NOT_ALLOWED_FOR_CASUAL',
      };
    }
  }

  // =====================================================
  // 2) Overlap check - prevent double-booking
  // =====================================================
  const overlappingRequests = await findOverlappingLeaveRequests(
    employee.id,
    startDate,
    endDate,
  );

  if (overlappingRequests.length > 0) {
    return {
      success: false,
      autoApproved: false,
      error: 'OVERLAPPING_LEAVE',
      details: overlappingRequests,
    };
  }

  // Calculate chargeable leave using leaveEngine (includes half-day support)
  const chargeableResult = await calculateChargeableLeave({
    start_date: startDate,
    end_date: endDate,
    employee_id: employee.id,
    partial_day_type: partialDayType,
  });
  const chargeableDays = safeNumber(
    chargeableResult.chargeableDays ?? chargeableResult.chargeable_days,
    0,
  );

  // Check balance using chargeableDays (same logic as front-end)
  const balanceCheck = await checkLeaveBalance(
    employee.id,
    leaveTypeId,
    chargeableDays,
    employee,
  );

  if (!balanceCheck.sufficient) {
    return {
      success: false,
      autoApproved: false,
      error: `Insufficient leave balance. You have ${formatHours(
        balanceCheck.available,
      )} hours available but need ${formatHours(balanceCheck.needed)} hours.`,
    };
  }

  const hasManager = !!employee.manager_id;
  const status = hasManager ? 'pending' : 'approved';

  const payload = {
    employee_id: employee.id,
    leave_type_id: leaveTypeId,
    start_date: startDate,
    end_date: endDate,
    total_days: chargeableDays,
    partial_day_type: partialDayType || 'full',
    status: status,
    reason: reason || null,
  };

  // Only include manager_id if employee has a manager
  if (hasManager) {
    payload.manager_id = employee.manager_id;
  }

  try {
    const createdRequest = await LeaveRequest.create(payload);

    // If auto-approved (no manager), deduct balance immediately and notify employee
    if (!hasManager) {
      await deductLeaveBalance(employee.id, leaveTypeId, balanceCheck.needed);
      await notifyEmployeeOfAutoApproval(employee, startDate, endDate);
    } else {
      // Notify manager about the new leave request
      await notifyManagerOfLeaveRequest(employee, createdRequest, leaveTypeId);
    }

    // Audit log
    const LeaveType = base44.entities.LeaveType;
    const leaveTypes = await LeaveType.filter({ id: leaveTypeId });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';
    await logForCurrentUser({
      eventType: 'leave_requested',
      entityType: 'LeaveRequest',
      entityId: createdRequest.id,
      relatedEmployeeId: employee.id,
      description: `${employee.first_name} ${employee.last_name} requested ${leaveTypeName} from ${startDate} to ${endDate}`,
    });

    // Invalidate leave cache after successful creation
    invalidateLeaveCache(employee.id);

    return {
      success: true,
      autoApproved: !hasManager,
      hoursDeducted: balanceCheck.needed,
    };
  } catch (error) {
    console.error('Error creating leave request:', error);
    return { success: false, autoApproved: false, error: error.message };
  }
}

/**
 * Send in-app notification to employee when leave is declined by manager.
 */
async function notifyEmployeeOfDecline(leaveRequest) {
  try {
    const Employee = base44.entities.Employee;
    const employees = await Employee.filter({ id: leaveRequest.employee_id });
    if (employees.length === 0 || !employees[0].user_id) return;

    const employee = employees[0];

    await sendNotification({
      userId: employee.user_id,
      type: 'leave_declined',
      title: 'Leave declined',
      message: `Your leave request has been declined.`,
      category: NotificationCategory.LEAVE_DECLINES,
      link: '/MyLeave',
      sendEmail: true,
      relatedEmployeeId: employee.id,
      relatedRequestId: leaveRequest.id,
    });
  } catch (error) {
    console.error('Error notifying employee of decline:', error);
  }
}

/**
 * Send in-app notification to employee when leave is approved by manager.
 */
async function notifyEmployeeOfApproval(leaveRequest, employee) {
  try {
    if (!employee.user_id) return;

    const LeaveType = base44.entities.LeaveType;
    const leaveTypes = await LeaveType.filter({
      id: leaveRequest.leave_type_id,
    });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';

    await sendNotification({
      userId: employee.user_id,
      type: 'leave_approved',
      title: 'Leave approved',
      message: `Your leave request (${leaveTypeName}) has been approved.`,
      category: NotificationCategory.LEAVE_APPROVALS,
      link: '/MyLeave',
      sendEmail: true,
      relatedEmployeeId: employee.id,
      relatedRequestId: leaveRequest.id,
    });
  } catch (error) {
    console.error('Error notifying employee of approval:', error);
  }
}

/**
 * Send in-app notification to employee when leave is auto-approved (no manager).
 */
async function notifyEmployeeOfAutoApproval(employee, startDate, endDate) {
  try {
    if (!employee.user_id) return;

    await sendNotification({
      userId: employee.user_id,
      type: 'leave_auto_approved',
      title: 'Leave auto-approved',
      message: `Your leave from ${startDate} to ${endDate} has been auto-approved.`,
      category: NotificationCategory.LEAVE_APPROVALS,
      link: '/MyLeave',
      sendEmail: false, // Low signal - no email for auto-approved
      relatedEmployeeId: employee.id,
    });
  } catch (error) {
    console.error('Error notifying employee of auto-approval:', error);
  }
}

/**
 * Send in-app notification to manager when a leave request is submitted.
 */
async function notifyManagerOfLeaveRequest(employee, leaveRequest, leaveTypeId) {
  try {
    const Employee = base44.entities.Employee;
    const LeaveType = base44.entities.LeaveType;

    // Get manager
    const managers = await Employee.filter({ id: employee.manager_id });
    if (managers.length === 0 || !managers[0].user_id) return;

    const manager = managers[0];

    // Get leave type name
    const leaveTypes = await LeaveType.filter({ id: leaveTypeId });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';

    const employeeName =
      employee.preferred_name || employee.first_name || 'An employee';

    await sendNotification({
      userId: manager.user_id,
      type: 'leave_submitted',
      title: 'New leave request',
      message: `${employeeName} ${
        employee.last_name || ''
      } has submitted a leave request (${leaveTypeName})`.trim(),
      category: NotificationCategory.LEAVE_REQUESTS,
      link: '/LeaveApprovals',
      sendEmail: true,
      relatedEmployeeId: employee.id,
      relatedRequestId: leaveRequest.id,
    });
  } catch (error) {
    console.error('Error notifying manager of leave request:', error);
  }
}

/**
 * Approve a leave request.
 * Updates status, deducts balance, and can send notification.
 *
 * PERMISSION CHECK: Validates that the current user can approve this request.
 * In staff mode, users cannot approve any leave requests.
 *
 * @param {Object} request - The leave request object
 * @param {Object} employee - The employee object (for calculating hours)
 * @param {string} [managerComment] - Optional manager comment
 * @param {Object} [currentUser] - Current user (for permission check)
 * @param {Object} [currentEmployee] - Current user's employee record
 * @param {Object} [preferences] - User preferences with acting_mode
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function approveLeaveRequest(
  request,
  employee,
  managerComment = '',
  currentUser = null,
  currentEmployee = null,
  preferences = null,
) {
  const LeaveRequest = base44.entities.LeaveRequest;

  // Check if request is already finalized
  const FINALIZED_STATUSES = ['approved', 'declined', 'cancelled'];
  if (FINALIZED_STATUSES.includes(request.status)) {
    return {
      success: false,
      error: 'LEAVE_ALREADY_FINALISED',
      message: 'This leave request has already been processed.',
    };
  }

  // Permission check: if user/preferences provided, validate permission
  if (currentUser && preferences) {
    if (!canApproveLeave(currentUser, request, currentEmployee, preferences)) {
      return {
        success: false,
        error:
          'Permission denied: You cannot approve this leave request in staff mode.',
      };
    }
  }

  try {
    // Update request status with audit fields
    const updatePayload = {
      status: 'approved',
      manager_comment: managerComment || null,
      approved_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    };

    // Set approved_by_id if we have the current employee
    if (currentEmployee?.id) {
      updatePayload.approved_by_id = currentEmployee.id;
    }

    await LeaveRequest.update(request.id, updatePayload);

    // Deduct leave balance using centralised LeaveEngine function
    await applyApprovedLeave(request.id);

    // Send email notification to employee
    await sendLeaveNotification(request.employee_id, 'approved', managerComment);

    // Send in-app notification to employee
    await notifyEmployeeOfApproval(request, employee);

    // Audit log
    const LeaveType = base44.entities.LeaveType;
    const leaveTypes = await LeaveType.filter({ id: request.leave_type_id });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';
    await logForCurrentUser({
      eventType: 'leave_approved',
      entityType: 'LeaveRequest',
      entityId: request.id,
      relatedEmployeeId: employee.id,
      description: `Approved ${employee.first_name} ${employee.last_name}'s ${leaveTypeName} from ${request.start_date} to ${request.end_date}`,
    });

    // Invalidate leave cache after approval
    invalidateLeaveCache(request.employee_id);

    return { success: true };
  } catch (error) {
    console.error('Error approving leave request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Decline a leave request.
 * Requires a decline reason.
 *
 * PERMISSION CHECK: Validates that the current user can decline this request.
 * In staff mode, users cannot decline any leave requests.
 *
 * @param {Object} request - The leave request object
 * @param {string} declineReason - Required reason for declining
 * @param {Object} [currentUser] - Current user (for permission check)
 * @param {Object} [currentEmployee] - Current user's employee record
 * @param {Object} [preferences] - User preferences with acting_mode
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function declineLeaveRequest(
  request,
  declineReason,
  currentUser = null,
  currentEmployee = null,
  preferences = null,
) {
  const LeaveRequest = base44.entities.LeaveRequest;

  // Check if request is already finalized
  const FINALIZED_STATUSES = ['approved', 'declined', 'cancelled'];
  if (FINALIZED_STATUSES.includes(request.status)) {
    return {
      success: false,
      error: 'LEAVE_ALREADY_FINALISED',
      message: 'This leave request has already been processed.',
    };
  }

  // Permission check: if user/preferences provided, validate permission
  if (currentUser && preferences) {
    if (!canApproveLeave(currentUser, request, currentEmployee, preferences)) {
      return {
        success: false,
        error:
          'Permission denied: You cannot decline this leave request in staff mode.',
      };
    }
  }

  if (!declineReason || declineReason.trim() === '') {
    return { success: false, error: 'A decline reason is required.' };
  }

  try {
    // Update request status with audit fields
    const updatePayload = {
      status: 'declined',
      manager_comment: declineReason,
      rejection_reason: declineReason,
      rejected_at: new Date().toISOString(),
      approved_at: null,
    };

    // Set approved_by_id (tracks who processed the request, even for rejections)
    if (currentEmployee?.id) {
      updatePayload.approved_by_id = currentEmployee.id;
    }

    await LeaveRequest.update(request.id, updatePayload);

    // Send email notification to employee with decline reason
    await sendLeaveNotification(request.employee_id, 'declined', declineReason);

    // Send in-app notification to employee
    await notifyEmployeeOfDecline(request);

    // Audit log
    const Employee = base44.entities.Employee;
    const employees = await Employee.filter({ id: request.employee_id });
    const emp = employees[0];
    const LeaveType = base44.entities.LeaveType;
    const leaveTypes = await LeaveType.filter({ id: request.leave_type_id });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';
    await logForCurrentUser({
      eventType: 'leave_declined',
      entityType: 'LeaveRequest',
      entityId: request.id,
      relatedEmployeeId: request.employee_id,
      description: `Declined ${emp?.first_name || ''} ${
        emp?.last_name || ''
      }'s ${leaveTypeName} request`,
    });

    // Invalidate leave cache after decline (pending hours released)
    invalidateLeaveCache(request.employee_id);

    return { success: true };
  } catch (error) {
    console.error('Error declining leave request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create leave on behalf of an employee (manager/admin use).
 * Auto-approves the leave and deducts balance immediately.
 *
 * Reuses all existing validation:
 * - Balance check
 * - Overlap check
 * - Casual restrictions for paid leave
 *
 * @param {Object} params
 * @param {string} params.managerId - The manager/admin's employee ID
 * @param {string} params.employeeId - The target employee's ID
 * @param {string} params.leaveTypeId - Leave type ID
 * @param {string} params.startDate - Start date (yyyy-MM-dd)
 * @param {string} params.endDate - End date (yyyy-MM-dd)
 * @param {string} [params.reason] - Optional reason
 * @param {Object} params.currentUser - Current user object (for role check)
 * @param {Object} params.managerEmployee - Manager's employee record
 * @param {Object} [params.preferences] - User preferences
 * @returns {Promise<{success: boolean, leave?: Object, error?: string, message?: string}>}
 */
export async function createLeaveAsManager(params) {
  const {
    managerId,
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    reason,
    currentUser,
    managerEmployee,
    preferences,
  } = params;

  const Employee = base44.entities.Employee;
  const LeaveRequest = base44.entities.LeaveRequest;

  // 1. Validate manager role
  const isAdmin =
    currentUser?.role === 'admin' ||
    (preferences?.acting_mode === 'admin' && currentUser?.role === 'admin');
  const isManager = managerEmployee?.is_manager === true;

  if (!isAdmin && !isManager) {
    return {
      success: false,
      error: 'NOT_AUTHORIZED',
      message:
        'You must be an admin or manager to create leave on behalf of employees.',
    };
  }

  // 2. Fetch target employee
  const employees = await Employee.filter({ id: employeeId });
  if (employees.length === 0) {
    return {
      success: false,
      error: 'EMPLOYEE_NOT_FOUND',
      message: 'Target employee not found.',
    };
  }
  const employee = employees[0];

  // 3. If manager (not admin), verify they manage this employee
  if (!isAdmin && isManager) {
    if (employee.manager_id !== managerId) {
      return {
        success: false,
        error: 'NOT_AUTHORIZED',
        message: 'You can only create leave for employees who report to you.',
      };
    }
  }

  // 4. Check casual employee restrictions for paid leave
  const employmentType = employee.employment_type || 'full_time';
  if (employmentType === 'casual') {
    const isPaid = await isPaidLeaveType(leaveTypeId);
    if (isPaid) {
      return {
        success: false,
        error: 'CASUAL_CANNOT_TAKE_PAID_LEAVE',
        message:
          'Casual employees are not eligible for paid annual or personal leave.',
      };
    }
  }

  // 5. Check for overlapping leave
  const overlappingRequests = await findOverlappingLeaveRequests(
    employeeId,
    startDate,
    endDate,
  );
  if (overlappingRequests.length > 0) {
    return {
      success: false,
      error: 'OVERLAPPING_LEAVE',
      message: 'Employee already has leave booked that overlaps these dates.',
      details: overlappingRequests,
    };
  }

  // 6. Calculate chargeable days
  const chargeableResult = await calculateChargeableLeave({
    start_date: startDate,
    end_date: endDate,
    employee_id: employeeId,
  });
  const chargeableDays = safeNumber(
    chargeableResult.chargeableDays ?? chargeableResult.chargeable_days,
    0,
  );

  // 7. Check balance
  const balanceCheck = await checkLeaveBalance(
    employeeId,
    leaveTypeId,
    chargeableDays,
    employee,
  );
  if (!balanceCheck.sufficient) {
    return {
      success: false,
      error: 'INSUFFICIENT_BALANCE',
      message: `Insufficient leave balance. Employee has ${formatHours(
        balanceCheck.available,
      )} hours available but needs ${formatHours(balanceCheck.needed)} hours.`,
    };
  }

  // 8. Create the leave request as approved
  const payload = {
    employee_id: employeeId,
    leave_type_id: leaveTypeId,
    start_date: startDate,
    end_date: endDate,
    total_days: chargeableDays,
    status: 'approved',
    reason: reason || null,
    approved_by_id: managerId,
    approved_at: new Date().toISOString(),
    manager_id: employee.manager_id || null,
  };

  try {
    const createdRequest = await LeaveRequest.create(payload);

    // 9. Deduct leave balance
    await deductLeaveBalance(employeeId, leaveTypeId, balanceCheck.needed);

    // 10. Notify employee
    await notifyEmployeeOfApproval(createdRequest, employee);

    // 11. Audit log
    const LeaveType = base44.entities.LeaveType;
    const leaveTypes = await LeaveType.filter({ id: leaveTypeId });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';
    await logForCurrentUser({
      eventType: 'leave_created_by_manager',
      entityType: 'LeaveRequest',
      entityId: createdRequest.id,
      relatedEmployeeId: employeeId,
      description: `Created and approved ${leaveTypeName} for ${employee.first_name} ${employee.last_name} from ${startDate} to ${endDate}`,
    });

    // Invalidate leave cache after manager creates leave
    invalidateLeaveCache(employeeId);

    return {
      success: true,
      leave: createdRequest,
      hoursDeducted: balanceCheck.needed,
    };
  } catch (error) {
    console.error('Error creating leave as manager:', error);
    return {
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create leave request.',
    };
  }
}

/**
 * Cancel a leave request.
 * If the request was approved, restores the deducted hours to the balance.
 *
 * NOTE: Permission check temporarily bypassed for MVP/dev testing.
 *
 * @param {Object} request - The leave request object
 * @param {Object} employee - The employee object
 * @param {Object} [currentUser] - Current user (unused - permissions bypassed)
 * @param {Object} [currentEmployee] - Current user's employee record (unused)
 * @param {Object} [preferences] - User preferences (unused)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function cancelLeaveRequest(
  request,
  employee,
  currentUser = null,
  currentEmployee = null,
  preferences = null,
) {
  const LeaveRequest = base44.entities.LeaveRequest;

  console.log('cancelLeaveRequest called', {
    id: request?.id,
    status: request?.status,
  });

  // Check if request is already finalized (declined or cancelled)
  if (request.status === 'declined' || request.status === 'cancelled') {
    return {
      success: false,
      error: 'LEAVE_ALREADY_FINALISED',
      message: 'This leave request has already been processed.',
    };
  }

  try {
    const wasApproved = request.status === 'approved';

    // Update request status to cancelled with audit field
    await LeaveRequest.update(request.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });
    console.log('LeaveRequest updated to cancelled', request.id);

    // If the request was approved, restore the hours using centralised LeaveEngine function
    if (wasApproved) {
      console.log('revertLeave called for request', request.id);
      await revertLeave(request.id);
    }

    // Audit log
    const LeaveType = base44.entities.LeaveType;
    const leaveTypes = await LeaveType.filter({ id: request.leave_type_id });
    const leaveTypeName =
      leaveTypes.length > 0 ? leaveTypes[0].name : 'Leave';
    await logForCurrentUser({
      eventType: 'leave_cancelled',
      entityType: 'LeaveRequest',
      entityId: request.id,
      relatedEmployeeId: employee.id,
      description: `${employee.first_name} ${employee.last_name} cancelled a ${leaveTypeName} request`,
    });

    // Invalidate leave cache after cancellation
    invalidateLeaveCache(employee.id);

    return { success: true, error: null };
  } catch (error) {
    console.error('cancelLeaveRequest error:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel leave request',
    };
  }
}

/**
 * Send a leave notification to an employee.
 * Checks user notification preferences before sending.
 * Uses the Core.SendEmail integration.
 *
 * @param {string} employeeId - Employee ID to notify
 * @param {string} status - 'approved' or 'declined'
 * @param {string} [managerComment] - Manager's comment
 */
async function sendLeaveNotification(employeeId, status, managerComment) {
  try {
    const Employee = base44.entities.Employee;
    const employees = await Employee.filter({ id: employeeId });
    const employee = employees[0];

    if (!employee?.email) {
      console.warn('No email found for employee:', employeeId);
      return;
    }

    // Check notification preferences
    const category =
      status === 'approved'
        ? NotificationCategory.LEAVE_APPROVALS
        : NotificationCategory.LEAVE_DECLINES;

    const sendEmail = await shouldSendEmail(employee.user_id, category);

    if (!sendEmail) {
      console.log(`Email notification disabled for ${category}, skipping.`);
      return;
    }

    const subject =
      status === 'approved'
        ? 'Your leave request has been approved'
        : 'Your leave request has been declined';

    let body =
      status === 'approved'
        ? 'Good news! Your leave request has been approved.'
        : 'Unfortunately, your leave request has been declined.';

    if (managerComment) {
      body += `\n\nManager's comment: ${managerComment}`;
    }

    await base44.integrations.Core.SendEmail({
      to: employee.email,
      subject: subject,
      body: body,
    });
  } catch (error) {
    // Don't fail the approval/decline if notification fails
    console.error('Error sending leave notification:', error);
  }
}
