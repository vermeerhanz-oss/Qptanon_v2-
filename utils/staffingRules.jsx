import { base44 } from '@/api/base44Client';
import { parseISO, isWithinInterval, areIntervalsOverlapping } from 'date-fns';

const StaffingRule = base44.entities.StaffingRule;
const Employee = base44.entities.Employee;
const LeaveRequest = base44.entities.LeaveRequest;

/**
 * Get the applicable staffing rule for an employee
 * Priority: department+entity > entity-only > global
 */
export async function getApplicableStaffingRule(employee) {
  if (!employee) return null;
  
  const rules = await StaffingRule.filter({ is_active: true });
  if (rules.length === 0) return null;
  
  // Priority 1: Entity + Department match
  if (employee.entity_id && employee.department_id) {
    const deptRule = rules.find(r => 
      r.entity_id === employee.entity_id && 
      r.department_id === employee.department_id
    );
    if (deptRule) return deptRule;
  }
  
  // Priority 2: Entity-only (no department)
  if (employee.entity_id) {
    const entityRule = rules.find(r => 
      r.entity_id === employee.entity_id && 
      !r.department_id
    );
    if (entityRule) return entityRule;
  }
  
  // Priority 3: Global rule (no entity, no department)
  const globalRule = rules.find(r => !r.entity_id && !r.department_id);
  return globalRule || null;
}

/**
 * Check for staffing conflicts if a leave request is approved
 * @returns {Object} { hasConflict, warnings[], overlappingLeave[], stats }
 */
export async function checkStaffingConflict(leaveRequest, employee) {
  if (!employee || !leaveRequest) {
    return { hasConflict: false, warnings: [], overlappingLeave: [], stats: null };
  }
  
  const rule = await getApplicableStaffingRule(employee);
  if (!rule) {
    return { hasConflict: false, warnings: [], overlappingLeave: [], stats: null };
  }
  
  const startDate = parseISO(leaveRequest.start_date);
  const endDate = parseISO(leaveRequest.end_date);
  const requestInterval = { start: startDate, end: endDate };
  
  // Get all employees in the same scope (entity/department)
  let scopeFilter = { status: 'active' };
  let scopeLabel = 'company';
  
  if (rule.department_id && employee.department_id) {
    scopeFilter.department_id = employee.department_id;
    scopeLabel = 'department';
  } else if (rule.entity_id && employee.entity_id) {
    scopeFilter.entity_id = employee.entity_id;
    scopeLabel = 'entity';
  }
  
  const employeesInScope = await Employee.filter(scopeFilter);
  const totalHeadcount = employeesInScope.length;
  
  // Get all approved leave requests that overlap with the requested dates
  const allApprovedLeave = await LeaveRequest.filter({ status: 'approved' });
  
  const overlappingLeave = allApprovedLeave.filter(lr => {
    // Must be from an employee in scope (not the requesting employee)
    const isInScope = employeesInScope.some(e => e.id === lr.employee_id);
    if (!isInScope) return false;
    if (lr.employee_id === leaveRequest.employee_id) return false;
    
    // Check date overlap
    const lrStart = parseISO(lr.start_date);
    const lrEnd = parseISO(lr.end_date);
    const lrInterval = { start: lrStart, end: lrEnd };
    
    return areIntervalsOverlapping(requestInterval, lrInterval, { inclusive: true });
  });
  
  const concurrentLeaveCount = overlappingLeave.length + 1; // +1 for the current request
  const activeAfterApproval = totalHeadcount - concurrentLeaveCount;
  
  const warnings = [];
  let hasConflict = false;
  
  // Check min_active_headcount
  if (rule.min_active_headcount && activeAfterApproval < rule.min_active_headcount) {
    hasConflict = true;
    warnings.push({
      type: 'min_headcount',
      message: `Approving this leave will leave only ${activeAfterApproval} active staff in the ${scopeLabel}, below the configured minimum of ${rule.min_active_headcount}.`,
      severity: 'warning',
      activeAfterApproval,
      minRequired: rule.min_active_headcount,
    });
  }
  
  // Check max_concurrent_leave
  if (rule.max_concurrent_leave && concurrentLeaveCount > rule.max_concurrent_leave) {
    hasConflict = true;
    warnings.push({
      type: 'max_concurrent',
      message: `Approving this leave will result in ${concurrentLeaveCount} employees on leave at once, exceeding the maximum of ${rule.max_concurrent_leave}.`,
      severity: 'warning',
      concurrentCount: concurrentLeaveCount,
      maxAllowed: rule.max_concurrent_leave,
    });
  }
  
  return {
    hasConflict,
    warnings,
    overlappingLeave,
    stats: {
      totalHeadcount,
      concurrentLeaveCount,
      activeAfterApproval,
      scopeLabel,
      rule,
    }
  };
}

/**
 * Get employee names for overlapping leave (for display)
 */
export async function enrichOverlappingLeave(overlappingLeave, employees) {
  return overlappingLeave.map(lr => {
    const emp = employees.find(e => e.id === lr.employee_id);
    return {
      ...lr,
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
    };
  });
}