/**
 * NES Compliance Checker for Australian Leave Policies
 * 
 * This module checks leave policies against National Employment Standards
 * minimum requirements. This is NOT legal advice - just a basic sanity check
 * for common configuration errors.
 */

/**
 * Check all policies for NES compliance issues
 * 
 * @param {Array} policies - All leave policies
 * @param {Array} leaveTypes - Available leave types (optional)
 * @param {Array} employees - Employee records (optional, for context)
 * @returns {Array<{policyId: string, policyName: string, severity: 'error'|'warning'|'info', message: string, rule: string}>}
 */
export function checkNESCompliance(policies, leaveTypes = [], employees = []) {
  const issues = [];
  
  if (!policies || policies.length === 0) {
    return issues;
  }

  for (const policy of policies) {
    // Skip inactive policies
    if (policy.is_active === false) continue;
    
    // Only check AU policies
    if (policy.country && policy.country !== 'AU') continue;

    const policyIssues = checkSinglePolicyCompliance(policy);
    issues.push(...policyIssues);
  }

  return issues;
}

/**
 * Check a single policy for NES compliance
 */
export function checkSinglePolicyCompliance(policy) {
  const issues = [];
  const policyId = policy.id;
  const policyName = policy.name || 'Unnamed Policy';

  // RULE 1: Annual Leave - Full Time (minimum 4 weeks)
  if (policy.leave_type === 'annual' && 
      (policy.employment_type_scope === 'full_time' || policy.employment_type_scope === 'any')) {
    
    const meetsMinimum = checkAnnualLeaveMinimum(policy);
    if (!meetsMinimum.valid) {
      issues.push({
        policyId,
        policyName,
        severity: 'error',
        message: `Annual Leave for full-time employees must accrue at least 4 weeks per year under NES. Current: ${meetsMinimum.current}`,
        rule: 'ANNUAL_FT_MIN',
      });
    }
  }

  // RULE 2: Personal Leave - Full Time (minimum 10 days)
  if (policy.leave_type === 'personal' && 
      (policy.employment_type_scope === 'full_time' || policy.employment_type_scope === 'any')) {
    
    const meetsMinimum = checkPersonalLeaveMinimum(policy);
    if (!meetsMinimum.valid) {
      issues.push({
        policyId,
        policyName,
        severity: 'error',
        message: `Personal/Carer's Leave for full-time employees must accrue at least 10 days per year under NES. Current: ${meetsMinimum.current}`,
        rule: 'PERSONAL_FT_MIN',
      });
    }
  }

  // RULE 3: Annual Leave - Part Time (same 4 weeks, pro-rated by system)
  if (policy.leave_type === 'annual' && policy.employment_type_scope === 'part_time') {
    const meetsMinimum = checkAnnualLeaveMinimum(policy);
    if (!meetsMinimum.valid) {
      issues.push({
        policyId,
        policyName,
        severity: 'error',
        message: `Annual Leave for part-time employees must accrue at least 4 weeks per year (pro-rata applied automatically). Current: ${meetsMinimum.current}`,
        rule: 'ANNUAL_PT_MIN',
      });
    }
  }

  // RULE 4: Personal Leave - Part Time (same 10 days, pro-rated)
  if (policy.leave_type === 'personal' && policy.employment_type_scope === 'part_time') {
    const meetsMinimum = checkPersonalLeaveMinimum(policy);
    if (!meetsMinimum.valid) {
      issues.push({
        policyId,
        policyName,
        severity: 'error',
        message: `Personal/Carer's Leave for part-time employees must accrue at least 10 days per year (pro-rata applied automatically). Current: ${meetsMinimum.current}`,
        rule: 'PERSONAL_PT_MIN',
      });
    }
  }

  // RULE 5: Casuals CANNOT have paid annual/personal leave
  if (policy.employment_type_scope === 'casual') {
    if (policy.leave_type === 'annual' || policy.leave_type === 'personal') {
      // Only flag if accrual_rate > 0
      const rate = parseFloat(policy.accrual_rate) || 0;
      if (rate > 0) {
        issues.push({
          policyId,
          policyName,
          severity: 'error',
          message: `Casual employees are not entitled to paid ${policy.leave_type === 'annual' ? 'annual' : 'personal/carer\'s'} leave under NES. This policy has an accrual rate of ${rate}.`,
          rule: 'CASUAL_NO_PAID_LEAVE',
        });
      }
    }
  }

  // RULE 6: Missing required configuration fields
  const missingFields = checkMissingFields(policy);
  if (missingFields.length > 0) {
    issues.push({
      policyId,
      policyName,
      severity: 'warning',
      message: `Policy is missing required fields: ${missingFields.join(', ')}`,
      rule: 'MISSING_FIELDS',
    });
  }

  // RULE 7: Shiftworker detection (5 weeks annual leave - informational)
  if (policy.leave_type === 'annual') {
    const weeksPerYear = convertToWeeksPerYear(policy);
    if (weeksPerYear >= 4.9 && weeksPerYear <= 5.1) {
      issues.push({
        policyId,
        policyName,
        severity: 'info',
        message: 'This appears to be a shiftworker 5-week annual leave policy, which is valid under certain awards.',
        rule: 'SHIFTWORKER_5_WEEKS',
      });
    }
  }

  return issues;
}

/**
 * Check if annual leave meets 4 weeks minimum
 */
function checkAnnualLeaveMinimum(policy) {
  const weeksPerYear = convertToWeeksPerYear(policy);
  return {
    valid: weeksPerYear >= 4,
    current: `${weeksPerYear.toFixed(1)} weeks/year`,
  };
}

/**
 * Check if personal leave meets 10 days minimum
 */
function checkPersonalLeaveMinimum(policy) {
  const daysPerYear = convertToDaysPerYear(policy);
  return {
    valid: daysPerYear >= 10,
    current: `${daysPerYear.toFixed(1)} days/year`,
  };
}

/**
 * Convert policy accrual to weeks per year for comparison
 */
function convertToWeeksPerYear(policy) {
  const rate = parseFloat(policy.accrual_rate) || 0;
  const hoursPerDay = parseFloat(policy.standard_hours_per_day) || 7.6;
  const hoursPerWeek = parseFloat(policy.hours_per_week_reference) || 38;

  switch (policy.accrual_unit) {
    case 'weeks_per_year':
      return rate;
    case 'days_per_year':
      return (rate * hoursPerDay) / hoursPerWeek;
    case 'hours_per_year':
      return rate / hoursPerWeek;
    default:
      return 0;
  }
}

/**
 * Convert policy accrual to days per year for comparison
 */
function convertToDaysPerYear(policy) {
  const rate = parseFloat(policy.accrual_rate) || 0;
  const hoursPerDay = parseFloat(policy.standard_hours_per_day) || 7.6;

  switch (policy.accrual_unit) {
    case 'days_per_year':
      return rate;
    case 'weeks_per_year':
      return rate * 5; // 5 working days per week
    case 'hours_per_year':
      return rate / hoursPerDay;
    default:
      return 0;
  }
}

/**
 * Check for missing required fields
 */
function checkMissingFields(policy) {
  const missing = [];

  if (!policy.accrual_unit) {
    missing.push('accrual_unit');
  }
  if (policy.accrual_rate == null || policy.accrual_rate === '') {
    missing.push('accrual_rate');
  }
  if (!policy.standard_hours_per_day || policy.standard_hours_per_day <= 0) {
    missing.push('standard_hours_per_day');
  }
  if (policy.accrual_unit === 'weeks_per_year' && 
      (!policy.hours_per_week_reference || policy.hours_per_week_reference <= 0)) {
    missing.push('hours_per_week_reference');
  }

  return missing;
}

/**
 * Get compliance summary for display
 */
export function getComplianceSummary(issues) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const info = issues.filter(i => i.severity === 'info');

  return {
    total: issues.length,
    errors: errors.length,
    warnings: warnings.length,
    info: info.length,
    isCompliant: errors.length === 0,
    hasWarnings: warnings.length > 0,
  };
}

/**
 * Get issues for a specific policy
 */
export function getIssuesForPolicy(policyId, issues) {
  return issues.filter(i => i.policyId === policyId);
}

/**
 * Get highest severity for a policy
 */
export function getHighestSeverityForPolicy(policyId, issues) {
  const policyIssues = getIssuesForPolicy(policyId, issues);
  if (policyIssues.some(i => i.severity === 'error')) return 'error';
  if (policyIssues.some(i => i.severity === 'warning')) return 'warning';
  if (policyIssues.some(i => i.severity === 'info')) return 'info';
  return null;
}