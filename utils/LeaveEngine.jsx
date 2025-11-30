import { base44 } from '@/api/base44Client';
import { getPublicHolidaysInRange } from './publicHolidays';
import { recalculateAllBalancesForEmployee } from './leaveAccrual';

const Employee = base44.entities.Employee;
const LeaveRequest = base44.entities.LeaveRequest;
const LeaveType = base44.entities.LeaveType;
const LeavePolicy = base44.entities.LeavePolicy;
const EmployeeLeaveBalance = base44.entities.EmployeeLeaveBalance;

async function getBalanceLeaveType(leaveTypeId) {
  const leaveTypes = await LeaveType.filter({ id: leaveTypeId });
  if (!leaveTypes.length) return 'annual';

  const lt = leaveTypes[0];
  const code = (lt.code || lt.name || '').toLowerCase();

  if (code.includes('personal') || code.includes('sick')) {
    return 'personal';
  }
  return 'annual';
}

async function getHoursPerDayForBalanceType(employee, balanceLeaveType) {
  const policies = await LeavePolicy.filter({
    leave_type: balanceLeaveType,
    is_default: true,
    is_active: true,
  });

  const policy = policies.length > 0 ? policies[0] : null;

  if (
    policy &&
    Number.isFinite(policy.standard_hours_per_day) &&
    policy.standard_hours_per_day > 0
  ) {
    return policy.standard_hours_per_day;
  }

  if (
    Number.isFinite(employee?.hours_per_week) &&
    employee.hours_per_week > 0
  ) {
    return employee.hours_per_week / 5;
  }

  return 7.6;
}

async function adjustEmployeeBalanceHours(
  employeeId,
  leaveTypeId,
  hoursDelta,
) {
  const balanceLeaveType = await getBalanceLeaveType(leaveTypeId);

  const existing = await EmployeeLeaveBalance.filter({
    employee_id: employeeId,
    leave_type: balanceLeaveType,
  });

  let balanceRecord;

  if (existing.length === 0) {
    balanceRecord = await EmployeeLeaveBalance.create({
      employee_id: employeeId,
      leave_type: balanceLeaveType,
      balance_hours: 0,
      last_calculated_date: new Date().toISOString().split('T')[0],
    });
  } else {
    balanceRecord = existing[0];
  }

  const current = Number.isFinite(balanceRecord.balance_hours)
    ? balanceRecord.balance_hours
    : 0;

  const newBalance = current + hoursDelta;

  await EmployeeLeaveBalance.update(balanceRecord.id, {
    balance_hours: newBalance,
    last_calculated_date: new Date().toISOString().split('T')[0],
  });

  return { success: true, newBalance };
}

export async function calculateChargeableLeave(params) {
  const {
    employee_id,
    start_date,
    end_date,
    partial_day_type = 'full',
  } = params || {};

  if (!employee_id || !start_date || !end_date) {
    return {
      totalDays: 0,
      total_days: 0,
      chargeableDays: 0,
      chargeable_days: 0,
      hoursPerDay: 0,
      hours_per_day: 0,
      hoursDeducted: 0,
      hours_deducted: 0,
      isHalfDay: false,
      partial_day_type: partial_day_type || 'full',
    };
  }

  const employees = await Employee.filter({ id: employee_id });
  if (employees.length === 0) {
    return {
      totalDays: 0,
      total_days: 0,
      chargeableDays: 0,
      chargeable_days: 0,
      hoursPerDay: 0,
      hours_per_day: 0,
      hoursDeducted: 0,
      hours_deducted: 0,
      isHalfDay: false,
      partial_day_type,
    };
  }

  const employee = employees[0];

  const start = new Date(start_date);
  const end = new Date(end_date);

  const holidays = await getPublicHolidaysInRange(
    employee.entity_id || null,
    start,
    end,
  );
  const holidayDates = new Set(holidays.map((h) => h.date));

  let totalDays = 0;
  let chargeableDays = 0;

  const isHalfDay =
    partial_day_type === 'half_am' || partial_day_type === 'half_pm';
  const isSingleDay = start_date === end_date;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalDays++;

    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

    const dateStr = d.toISOString().split('T')[0];
    if (holidayDates.has(dateStr)) continue;

    let dayCharge = 1;

    if (isHalfDay && isSingleDay && dateStr === start_date) {
      dayCharge = 0.5;
    }

    chargeableDays += dayCharge;
  }

  const hoursPerDay =
    Number.isFinite(employee.hours_per_week) && employee.hours_per_week > 0
      ? employee.hours_per_week / 5
      : 7.6;

  const hoursDeducted = chargeableDays * hoursPerDay;

  return {
    totalDays,
    chargeableDays,
    hoursPerDay,
    hoursDeducted,

    total_days: totalDays,
    chargeable_days: chargeableDays,
    hours_per_day: hoursPerDay,
    hours_deducted: hoursDeducted,

    isHalfDay,
    partial_day_type,
  };
}

export async function applyApprovedLeave(leaveRequestId) {
  if (!leaveRequestId) {
    return { success: false, error: 'Leave request ID is required' };
  }

  const reqs = await LeaveRequest.filter({ id: leaveRequestId });
  if (!reqs.length) {
    return { success: false, error: 'Leave request not found' };
  }

  const request = reqs[0];

  const employees = await Employee.filter({ id: request.employee_id });
  if (!employees.length) {
    return { success: false, error: 'Employee not found' };
  }

  const employee = employees[0];

  let chargeableDays = 0;

  if (
    Number.isFinite(request.total_days) &&
    request.total_days !== null &&
    request.total_days > 0
  ) {
    chargeableDays = request.total_days;
  } else {
    const breakdown = await calculateChargeableLeave({
      employee_id: request.employee_id,
      start_date: request.start_date,
      end_date: request.end_date,
      partial_day_type: request.partial_day_type || 'full',
    });

    chargeableDays = breakdown.chargeableDays || breakdown.chargeable_days || 0;
  }

  const balanceLeaveType = await getBalanceLeaveType(request.leave_type_id);
  const hoursPerDay = await getHoursPerDayForBalanceType(
    employee,
    balanceLeaveType,
  );

  const hours = chargeableDays * hoursPerDay;

  try {
    await adjustEmployeeBalanceHours(
      request.employee_id,
      request.leave_type_id,
      -hours,
    );
    return { success: true };
  } catch (error) {
    console.error('applyApprovedLeave error:', error);
    return { success: false, error: error.message || 'Failed to apply leave' };
  }
}

export async function revertLeave(leaveRequestId) {
  if (!leaveRequestId) {
    return { success: false, error: 'Leave request ID is required' };
  }

  const reqs = await LeaveRequest.filter({ id: leaveRequestId });
  if (!reqs.length) {
    return { success: false, error: 'Leave request not found' };
  }

  const request = reqs[0];

  if (request.status !== 'approved') {
    return { success: true };
  }

  const employees = await Employee.filter({ id: request.employee_id });
  if (!employees.length) {
    return { success: false, error: 'Employee not found' };
  }

  const employee = employees[0];

  let chargeableDays = 0;

  if (
    Number.isFinite(request.total_days) &&
    request.total_days !== null &&
    request.total_days > 0
  ) {
    chargeableDays = request.total_days;
  } else {
    const breakdown = await calculateChargeableLeave({
      employee_id: request.employee_id,
      start_date: request.start_date,
      end_date: request.end_date,
      partial_day_type: request.partial_day_type || 'full',
    });

    chargeableDays = breakdown.chargeableDays || breakdown.chargeable_days || 0;
  }

  const balanceLeaveType = await getBalanceLeaveType(request.leave_type_id);
  const hoursPerDay = await getHoursPerDayForBalanceType(
    employee,
    balanceLeaveType,
  );

  const hours = chargeableDays * hoursPerDay;

  try {
    await adjustEmployeeBalanceHours(
      request.employee_id,
      request.leave_type_id,
      +hours,
    );
    return { success: true };
  } catch (error) {
    console.error('revertLeave error:', error);
    return {
      success: false,
      error: error.message || 'Failed to revert leave',
    };
  }
}

export async function getLeaveHistoryForEmployee(employeeId) {
  if (!employeeId) {
    return [];
  }

  const requests = await LeaveRequest.filter({ employee_id: employeeId });

  if (!requests || !requests.length) {
    return [];
  }

  const allTypes = await LeaveType.list();
  const typeNameMap = {};
  for (const t of allTypes) {
    typeNameMap[t.id] = t.name || t.code || null;
  }

  const sorted = [...requests].sort((a, b) => {
    const aDate = a.start_date || '';
    const bDate = b.start_date || '';
    return bDate.localeCompare(aDate);
  });

  return sorted.map((req) => ({
    ...req,
    leave_type_name: typeNameMap[req.leave_type_id] || null,
  }));
}

export async function recalcAllLeaveForEmployee(employeeId) {
  if (!employeeId) {
    return { success: false, error: 'Employee ID is required' };
  }

  try {
    const result = await recalculateAllBalancesForEmployee(employeeId);
    return { success: true, ...result };
  } catch (error) {
    console.error('recalcAllLeaveForEmployee error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to recalc leave for employee',
    };
  }
}