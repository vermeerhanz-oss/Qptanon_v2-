import { base44 } from '@/api/base44Client';
import {
  differenceInDays,
  parseISO,
  format,
  isAfter,
  isSameDay,
} from 'date-fns';

const LeavePolicy = base44.entities.LeavePolicy;
const LeaveBalance = base44.entities.LeaveBalance;
const Employee = base44.entities.Employee;
const EmploymentAgreement = base44.entities.EmploymentAgreement;

/**
 * Leave Accrual Engine (legacy / policy helper)
 *
 * Calculates leave accruals based on policies and continuous service.
 * The pure helpers here are used by leaveBalanceService as the
 * single source of truth for “how much should this person accrue”.
 *
 * NOTE: This is a configurable system. Actual legal compliance with
 * awards, enterprise agreements, or legislation is the customer's responsibility.
 */

/**
 * Get the employee's override policy field for a leave type
 */
function getEmployeePolicyField(leaveType) {
  const mapping = {
    annual: 'annual_leave_policy_id',
    personal: 'personal_leave_policy_id',
    sick: 'personal_leave_policy_id', // sick maps to personal
    long_service: 'long_service_leave_policy_id',
  };
  return mapping[leaveType] || null;
}

/**
 * Get the agreement's default policy field for a leave type
 */
function getAgreementPolicyField(leaveType) {
  const mapping = {
    annual: 'default_annual_leave_policy_id',
    personal: 'default_personal_leave_policy_id',
    sick: 'default_personal_leave_policy_id', // sick maps to personal
    long_service: 'default_long_service_leave_policy_id',
  };
  return mapping[leaveType] || null;
}

/**
 * Get the applicable policy for an employee and leave type
 * Priority:
 * 1. Employee-specific policy override (annual_leave_policy_id, etc.)
 * 2. Employment Agreement default policy (if agreement assigned)
 * 3. Default policy matching employment_type_scope + leave_type
 * 4. Default policy with employment_type_scope = 'any'
 * 5. Any default policy for this leave_type
 */
export async function getApplicablePolicyForEmployee(
  employeeId,
  leaveType,
  employee = null
) {
  // Get employee if not provided
  if (!employee) {
    const employees = await Employee.filter({ id: employeeId });
    if (employees.length === 0) return null;
    employee = employees[0];
  }

  // 1. Check employee-specific policy override
  const policyField = getEmployeePolicyField(leaveType);
  if (policyField && employee[policyField]) {
    const policies = await LeavePolicy.filter({ id: employee[policyField] });
    if (policies.length > 0 && policies[0].is_active) {
      return policies[0];
    }
  }

  // 2. Check Employment Agreement default policy
  if (employee.employment_agreement_id) {
    const agreements = await EmploymentAgreement.filter({
      id: employee.employment_agreement_id,
    });
    if (agreements.length > 0 && agreements[0].is_active) {
      const agreement = agreements[0];
      const agreementPolicyField = getAgreementPolicyField(leaveType);
      if (agreementPolicyField && agreement[agreementPolicyField]) {
        const policies = await LeavePolicy.filter({
          id: agreement[agreementPolicyField],
        });
        if (policies.length > 0 && policies[0].is_active) {
          return policies[0];
        }
      }
    }
  }

  // 3. Check for balance-specific policy (legacy support)
  const balances = await LeaveBalance.filter({
    employee_id: employeeId,
    leave_type: leaveType,
  });

  if (balances.length > 0 && balances[0].policy_id) {
    const policies = await LeavePolicy.filter({ id: balances[0].policy_id });
    if (policies.length > 0 && policies[0].is_active) {
      return policies[0];
    }
  }

  // 4. Find default policy by employment type
  const employmentType = employee.employment_type || 'full_time';

  // Try to find policy matching specific employment type
  let defaultPolicies = await LeavePolicy.filter({
    leave_type: leaveType,
    employment_type_scope: employmentType,
    is_default: true,
    is_active: true,
  });

  if (defaultPolicies.length > 0) {
    return defaultPolicies[0];
  }

  // 5. Fall back to 'any' employment type scope
  defaultPolicies = await LeavePolicy.filter({
    leave_type: leaveType,
    employment_type_scope: 'any',
    is_default: true,
    is_active: true,
  });

  if (defaultPolicies.length > 0) {
    return defaultPolicies[0];
  }

  // 6. Last resort: any default policy for this leave type
  defaultPolicies = await LeavePolicy.filter({
    leave_type: leaveType,
    is_default: true,
    is_active: true,
  });

  if (defaultPolicies.length > 0) {
    return defaultPolicies[0];
  }

  return null;
}

/**
 * Calculate FTE fraction for an employee
 * @param {Object} employee - Employee object with hours_per_week and employment_type
 * @param {Object} policy - LeavePolicy for reference hours
 * @returns {number} - FTE fraction (0 to 1)
 */
export function calculateEmployeeFTE(employee, policy = null) {
  const fullTimeHours = policy?.hours_per_week_reference || 38;

  // Full-time is always 1.0 FTE
  if (employee?.employment_type === 'full_time') {
    return 1.0;
  }

  // Part-time with hours_per_week set
  if (employee?.employment_type === 'part_time' && employee.hours_per_week) {
    return Math.min(employee.hours_per_week / fullTimeHours, 1.0);
  }

  // Casual/contractor with hours set
  if (employee?.hours_per_week) {
    return Math.min(employee.hours_per_week / fullTimeHours, 1.0);
  }

  // Default to 1.0 if no hours info
  return 1.0;
}

/**
 * Calculate accrual for a period based on policy
 * Applies pro-rata for part-time employees based on FTE
 * @param {Object} policy - LeavePolicy object
 * @param {number} daysSinceLastAccrual - Number of days in the accrual period
 * @param {number} accrualRateOverride - Optional override for accrual rate (used for LSL after threshold)
 * @param {Object} employee - Optional employee for pro-rata calculation
 * @returns {number} - Hours accrued
 */
export function calculateAccrualForPeriod(
  policy,
  daysSinceLastAccrual,
  accrualRateOverride = null,
  employee = null
) {
  if (!policy || daysSinceLastAccrual <= 0) {
    return 0;
  }

  const accrualRate = accrualRateOverride ?? policy.accrual_rate;
  if (!accrualRate) return 0;

  const standardHoursPerDay = policy.standard_hours_per_day || 7.6;
  const hoursPerWeek = policy.hours_per_week_reference || 38;

  // Convert accrual rate to hours per year
  let hoursPerYear;
  if (policy.accrual_unit === 'hours_per_year') {
    hoursPerYear = accrualRate;
  } else if (policy.accrual_unit === 'weeks_per_year') {
    // weeks_per_year - convert to hours
    hoursPerYear = accrualRate * hoursPerWeek;
  } else {
    // days_per_year - convert to hours
    hoursPerYear = accrualRate * standardHoursPerDay;
  }

  // Apply FTE fraction for pro-rata (part-time employees)
  if (employee) {
    const fte = calculateEmployeeFTE(employee, policy);
    hoursPerYear = hoursPerYear * fte;
  }

  // Calculate daily accrual rate and apply to period
  const hoursPerDay = hoursPerYear / 365;
  const accruedHours = hoursPerDay * daysSinceLastAccrual;

  // Round to 2 decimal places
  return Math.round(accruedHours * 100) / 100;
}

/**
 * Calculate Long Service Leave accrual with threshold logic
 * Only accrues after employee has completed min_service_years_before_accrual
 * @param {Object} policy - LeavePolicy with LSL config
 * @param {Object} employee - Employee record
 * @param {Date} asOfDate - Date to calculate up to
 * @param {Date} lastAccrualDate - Date of last accrual
 * @returns {Object} - { accruedHours, eligible, yearsOfService, eligibilityDate }
 */
export function calculateLSLAccrual(
  policy,
  employee,
  asOfDate,
  lastAccrualDate
) {
  const serviceStartDate = getServiceStartDate(employee);

  // If no start date, employee is not eligible for LSL
  if (!serviceStartDate) {
    return {
      accruedHours: 0,
      eligible: false,
      yearsOfService: 0,
      eligibilityDate: null,
      message: 'No service start date set for employee',
    };
  }

  const startDate = parseISO(serviceStartDate);

  const yearsOfService = differenceInDays(asOfDate, startDate) / 365;
  const minYears = policy.min_service_years_before_accrual || 0;

  // Calculate eligibility date
  const eligibilityDate = new Date(startDate);
  eligibilityDate.setFullYear(eligibilityDate.getFullYear() + minYears);

  // Not yet eligible
  if (yearsOfService < minYears) {
    return {
      accruedHours: 0,
      eligible: false,
      yearsOfService: Math.round(yearsOfService * 100) / 100,
      eligibilityDate: format(eligibilityDate, 'yyyy-MM-dd'),
      message: `Not yet eligible. ${minYears} years of service required.`,
    };
  }

  // Calculate accrual only for period after threshold (or from last accrual)
  const thresholdDate = eligibilityDate;
  const effectiveStartDate = isAfter(lastAccrualDate, thresholdDate)
    ? lastAccrualDate
    : thresholdDate;

  // If last accrual was before threshold, start from threshold date
  const daysToAccrue = differenceInDays(asOfDate, effectiveStartDate);

  if (daysToAccrue <= 0) {
    return {
      accruedHours: 0,
      eligible: true,
      yearsOfService: Math.round(yearsOfService * 100) / 100,
      eligibilityDate: format(eligibilityDate, 'yyyy-MM-dd'),
      message: 'Already up to date',
    };
  }

  // Use accrual_rate_after_threshold if set, otherwise use standard accrual_rate
  const rateToUse = policy.accrual_rate_after_threshold || policy.accrual_rate;
  const accruedHours = calculateAccrualForPeriod(
    policy,
    daysToAccrue,
    rateToUse
  );

  return {
    accruedHours,
    eligible: true,
    yearsOfService: Math.round(yearsOfService * 100) / 100,
    eligibilityDate: format(eligibilityDate, 'yyyy-MM-dd'),
    daysAccrued: daysToAccrue,
  };
}

/**
 * Get the service start date for an employee (for leave accrual).
 * Priority: service_start_date > start_date
 * Returns null if no valid date is found
 */
export function getServiceStartDate(employee) {
  if (employee?.service_start_date) {
    return employee.service_start_date;
  }
  if (employee?.start_date) {
    return employee.start_date;
  }
  // Return null as “no start date”
  return null;
}

/**
 * Get the service start date for an employee with a fallback to today
 * Use this when you need a guaranteed date string
 */
export function getServiceStartDateOrToday(employee) {
  const date = getServiceStartDate(employee);
  return date || format(new Date(), 'yyyy-MM-dd');
}

/**
 * Get or create a leave balance for an employee and leave type
 * (legacy LeaveBalance table)
 */
export async function getOrCreateLeaveBalance(
  employeeId,
  leaveType,
  employee = null
) {
  const balances = await LeaveBalance.filter({
    employee_id: employeeId,
    leave_type: leaveType,
  });

  if (balances.length > 0) {
    return balances[0];
  }

  // Create new balance
  // Use service_start_date as initial accrual date (continuous service)
  let startDate = format(new Date(), 'yyyy-MM-dd');
  if (employee) {
    const empStartDate = getServiceStartDate(employee);
    if (empStartDate) {
      startDate = empStartDate;
    }
  } else {
    const employees = await Employee.filter({ id: employeeId });
    if (employees.length > 0) {
      const empStartDate = getServiceStartDate(employees[0]);
      if (empStartDate) {
        startDate = empStartDate;
      }
    }
  }

  const newBalance = await LeaveBalance.create({
    employee_id: employeeId,
    leave_type: leaveType,
    opening_balance_hours: 0,
    accrued_hours: 0,
    taken_hours: 0,
    adjusted_hours: 0,
    available_hours: 0,
    last_accrual_date: startDate,
  });

  return newBalance;
}

/**
 * Accrue leave for a specific employee up to a given date
 * Skips accrual if already accrued today (prevents double-accruing)
 * @param {string} employeeId - Employee ID
 * @param {Date|string} asOfDate - Date to accrue up to (default: today)
 * @returns {Object} - Result with accrual details per leave type
 */
export async function accrueLeaveForEmployee(
  employeeId,
  asOfDate = new Date()
) {
  const asOfDateParsed =
    typeof asOfDate === 'string' ? parseISO(asOfDate) : asOfDate;
  const asOfDateStr = format(asOfDateParsed, 'yyyy-MM-dd');

  // Get employee to check start date and status
  const employees = await Employee.filter({ id: employeeId });
  if (employees.length === 0) {
    return { success: false, error: 'Employee not found' };
  }

  const employee = employees[0];

  // Don't accrue for terminated employees
  if (employee.status === 'terminated') {
    return { success: false, error: 'Cannot accrue leave for terminated employee' };
  }

  // Get all active leave types with default policies
  const activePolicies = await LeavePolicy.filter({ is_active: true });
  const leaveTypes = [...new Set(activePolicies.map((p) => p.leave_type))];

  const results = {};

  for (const leaveType of leaveTypes) {
    const policy = await getApplicablePolicyForEmployee(
      employeeId,
      leaveType,
      employee
    );
    if (!policy) continue;

    const balance = await getOrCreateLeaveBalance(employeeId, leaveType, employee);

    // Link balance to resolved policy if not already linked
    if (!balance.policy_id && policy.id) {
      await LeaveBalance.update(balance.id, { policy_id: policy.id });
    }

    // Skip if already accrued today or in the future (prevents double-accruing)
    if (balance.last_accrual_date) {
      const lastAccrualParsed = parseISO(balance.last_accrual_date);
      if (
        isSameDay(lastAccrualParsed, asOfDateParsed) ||
        isAfter(lastAccrualParsed, asOfDateParsed)
      ) {
        results[leaveType] = {
          accrued: 0,
          message: 'Already accrued today',
          available_hours: balance.available_hours,
          skipped: true,
        };
        continue;
      }
    }

    // Calculate days since last accrual
    // Use service_start_date for continuous service calculations
    const serviceStartDate = getServiceStartDate(employee);

    // If no service start date and no last_accrual_date, skip this leave type
    if (!serviceStartDate && !balance.last_accrual_date) {
      results[leaveType] = {
        accrued: 0,
        message: 'No service start date set',
        available_hours: balance.available_hours || 0,
      };
      continue;
    }

    const lastAccrualDate = balance.last_accrual_date
      ? parseISO(balance.last_accrual_date)
      : parseISO(serviceStartDate || format(new Date(), 'yyyy-MM-dd'));

    const daysSinceLastAccrual = differenceInDays(
      asOfDateParsed,
      lastAccrualDate
    );

    if (daysSinceLastAccrual <= 0) {
      results[leaveType] = {
        accrued: 0,
        message: 'Already up to date',
        available_hours: balance.available_hours,
      };
      continue;
    }

    // Special handling for Long Service Leave
    let accruedHours;
    if (
      leaveType === 'long_service' &&
      policy.min_service_years_before_accrual
    ) {
      const lslResult = calculateLSLAccrual(
        policy,
        employee,
        asOfDateParsed,
        lastAccrualDate
      );

      if (!lslResult.eligible) {
        results[leaveType] = {
          accrued: 0,
          eligible: false,
          years_of_service: lslResult.yearsOfService,
          eligibility_date: lslResult.eligibilityDate,
          message: lslResult.message,
          available_hours: balance.available_hours,
        };
        continue;
      }

      accruedHours = lslResult.accruedHours;
    } else {
      // Standard accrual calculation with pro-rata for part-time
      accruedHours = calculateAccrualForPeriod(
        policy,
        daysSinceLastAccrual,
        null,
        employee
      );
    }

    // Update balance
    const newAccruedTotal = (balance.accrued_hours || 0) + accruedHours;
    const newAvailable =
      (balance.opening_balance_hours || 0) +
      newAccruedTotal +
      (balance.adjusted_hours || 0) -
      (balance.taken_hours || 0);

    await LeaveBalance.update(balance.id, {
      accrued_hours: newAccruedTotal,
      available_hours: Math.round(newAvailable * 100) / 100,
      last_accrual_date: asOfDateStr,
    });

    results[leaveType] = {
      accrued: accruedHours,
      days_in_period: daysSinceLastAccrual,
      available_hours: Math.round(newAvailable * 100) / 100,
      policy_name: policy.name,
    };
  }

  return { success: true, results };
}

/**
 * Recalculate all balances for an employee from scratch
 * Re-accrues from service_start_date to today, useful when policies or dates change
 */
export async function recalculateAllBalancesForEmployee(employeeId) {
  // Get employee
  const employees = await Employee.filter({ id: employeeId });
  if (employees.length === 0) {
    return { success: false, error: 'Employee not found' };
  }

  const employee = employees[0];
  const serviceStartDate = getServiceStartDate(employee);
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // If no service start date, return zero balances without error
  if (!serviceStartDate) {
    return {
      success: true,
      results: {},
      message: 'No service start date set - no accrual calculated',
    };
  }

  // Get all active policies
  const activePolicies = await LeavePolicy.filter({ is_active: true });
  const leaveTypes = [...new Set(activePolicies.map((p) => p.leave_type))];

  const results = {};

  for (const leaveType of leaveTypes) {
    const policy = await getApplicablePolicyForEmployee(
      employeeId,
      leaveType,
      employee
    );
    if (!policy) continue;

    const balance = await getOrCreateLeaveBalance(employeeId, leaveType, employee);

    // Calculate total accrual from service start to today
    const startDate = parseISO(serviceStartDate);
    const daysSinceStart = differenceInDays(today, startDate);

    if (daysSinceStart <= 0) {
      results[leaveType] = {
        recalculated: false,
        message: 'No service days',
      };
      continue;
    }

    // Special handling for Long Service Leave
    let totalAccruedHours;
    if (
      leaveType === 'long_service' &&
      policy.min_service_years_before_accrual
    ) {
      const lslResult = calculateLSLAccrual(policy, employee, today, startDate);

      if (!lslResult.eligible) {
        results[leaveType] = {
          recalculated: true,
          accrued_hours: 0,
          available_hours: balance.available_hours,
          eligible: false,
          years_of_service: lslResult.yearsOfService,
          eligibility_date: lslResult.eligibilityDate,
          message: lslResult.message,
        };
        // Still update balance to show 0 accrued
        await LeaveBalance.update(balance.id, {
          accrued_hours: 0,
          available_hours:
            (balance.opening_balance_hours || 0) +
            (balance.adjusted_hours || 0) -
            (balance.taken_hours || 0),
          last_accrual_date: todayStr,
        });
        continue;
      }

      totalAccruedHours = lslResult.accruedHours;
    } else {
      // Standard accrual calculation with pro-rata for part-time
      totalAccruedHours = calculateAccrualForPeriod(
        policy,
        daysSinceStart,
        null,
        employee
      );
    }

    // Recalculate available (keep opening, taken, adjusted as-is)
    const newAvailable =
      (balance.opening_balance_hours || 0) +
      totalAccruedHours +
      (balance.adjusted_hours || 0) -
      (balance.taken_hours || 0);

    await LeaveBalance.update(balance.id, {
      accrued_hours: Math.round(totalAccruedHours * 100) / 100,
      available_hours: Math.round(newAvailable * 100) / 100,
      last_accrual_date: todayStr,
    });

    results[leaveType] = {
      recalculated: true,
      accrued_hours: Math.round(totalAccruedHours * 100) / 100,
      available_hours: Math.round(newAvailable * 100) / 100,
      days_since_start: daysSinceStart,
    };
  }

  return { success: true, results };
}

/**
 * Batch recalculate leave balances for all active employees in an entity
 * @param {string} entityId - Optional entity ID to filter employees
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {Object} - Results with count of processed employees
 */
export async function recalculateAllBalancesForEntity(
  entityId = null,
  onProgress = null
) {
  // Get all active employees (optionally filtered by entity)
  let employees;
  if (entityId) {
    employees = await Employee.filter({ entity_id: entityId, status: 'active' });
  } else {
    employees = await Employee.filter({ status: 'active' });
  }

  const total = employees.length;
  let processed = 0;
  const errors = [];

  for (const employee of employees) {
    try {
      await recalculateAllBalancesForEmployee(employee.id);
      processed++;
      if (onProgress) {
        onProgress({ processed, total, current: employee });
      }
    } catch (error) {
      errors.push({ employeeId: employee.id, error: error.message });
    }
  }

  return {
    success: errors.length === 0,
    processed,
    total,
    errors,
  };
}

/**
 * Apply a manual adjustment to an employee's leave balance
 */
export async function adjustLeaveBalance(
  employeeId,
  leaveType,
  adjustmentHours,
  reason = ''
) {
  const balance = await getOrCreateLeaveBalance(employeeId, leaveType);

  const newAdjusted = (balance.adjusted_hours || 0) + adjustmentHours;
  const newAvailable =
    (balance.opening_balance_hours || 0) +
    (balance.accrued_hours || 0) +
    newAdjusted -
    (balance.taken_hours || 0);

  await LeaveBalance.update(balance.id, {
    adjusted_hours: newAdjusted,
    available_hours: Math.round(newAvailable * 100) / 100,
  });

  return {
    success: true,
    new_available_hours: Math.round(newAvailable * 100) / 100,
  };
}

/**
 * Deduct hours from balance when leave is taken/approved
 */
export async function deductFromBalance(employeeId, leaveType, hoursToDeduct) {
  const balance = await getOrCreateLeaveBalance(employeeId, leaveType);

  const newTaken = (balance.taken_hours || 0) + hoursToDeduct;
  const newAvailable =
    (balance.opening_balance_hours || 0) +
    (balance.accrued_hours || 0) +
    (balance.adjusted_hours || 0) -
    newTaken;

  await LeaveBalance.update(balance.id, {
    taken_hours: newTaken,
    available_hours: Math.round(newAvailable * 100) / 100,
  });

  return {
    success: true,
    new_available_hours: Math.round(newAvailable * 100) / 100,
  };
}

/**
 * Convert days to hours using policy's standard hours
 */
export function daysToHours(days, policy) {
  const standardHours = policy?.standard_hours_per_day || 7.6;
  return days * standardHours;
}

/**
 * Convert hours to days for display
 * Returns 0 for non-numeric or invalid values
 */
export function hoursToDays(hours, standardHoursPerDay = 7.6) {
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeStandardHours =
    Number.isFinite(standardHoursPerDay) && standardHoursPerDay > 0
      ? standardHoursPerDay
      : 7.6;
  return Math.round((safeHours / safeStandardHours) * 100) / 100;
}
