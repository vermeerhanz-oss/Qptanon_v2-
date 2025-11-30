import { base44 } from '@/api/base44Client';
import { getVisibleEmployeeIdsForLeave } from './permissions';

const LeaveRequest = base44.entities.LeaveRequest;
const Employee = base44.entities.Employee;
const Department = base44.entities.Department;

/**
 * Leave Calendar Helpers
 * 
 * Optimized helpers for leave calendar data fetching.
 * Single query approach - no N+1 issues.
 */

/**
 * Fetch all team leave for a date range in a single optimized query.
 * Returns normalized leave data with employee info.
 * 
 * @param {Object} params
 * @param {string} params.startDate - Start date (yyyy-MM-dd)
 * @param {string} params.endDate - End date (yyyy-MM-dd)
 * @param {Object} params.user - Current user
 * @param {Object} params.currentEmployee - Current user's employee record
 * @param {Object} params.preferences - User preferences
 * @param {Array<string>} [params.statusFilter] - Statuses to include
 * @param {string} [params.departmentId] - Filter by department
 * @param {Set<string>} [params.employeeIds] - Filter by specific employees
 * @returns {Promise<{
 *   leave: Array,
 *   employees: Object,
 *   departments: Array
 * }>}
 */
export async function getTeamLeaveForCalendar({
  startDate,
  endDate,
  user,
  currentEmployee,
  preferences,
  statusFilter = ['approved', 'pending'],
  departmentId = null,
  employeeIds = null,
}) {
  // Single parallel fetch for all data
  const [allEmployees, allLeave, allDepartments] = await Promise.all([
    Employee.filter({ status: 'active' }),
    LeaveRequest.list(),
    Department.list(),
  ]);

  // Get visible employee IDs based on permissions
  const visibleIds = getVisibleEmployeeIdsForLeave(
    user,
    currentEmployee,
    preferences,
    allEmployees
  );

  // Build employee and department maps
  const employeeMap = {};
  const deptMap = {};
  allEmployees.forEach(e => { employeeMap[e.id] = e; });
  allDepartments.forEach(d => { deptMap[d.id] = d; });

  // Filter leave requests
  const filteredLeave = allLeave.filter(req => {
    // Status filter
    if (!statusFilter.includes(req.status)) return false;
    
    // Permission filter
    if (!visibleIds.has(req.employee_id)) return false;
    
    // Date range overlap
    if (req.end_date < startDate || req.start_date > endDate) return false;
    
    // Department filter
    if (departmentId) {
      const emp = employeeMap[req.employee_id];
      if (!emp || emp.department_id !== departmentId) return false;
    }
    
    // Employee filter
    if (employeeIds && employeeIds.size > 0) {
      if (!employeeIds.has(req.employee_id)) return false;
    }
    
    return true;
  });

  // Normalize leave data
  const normalizedLeave = filteredLeave.map(req => {
    const emp = employeeMap[req.employee_id];
    return {
      id: req.id,
      employeeId: req.employee_id,
      employeeName: emp ? `${emp.preferred_name || emp.first_name} ${emp.last_name}` : 'Unknown',
      leaveTypeId: req.leave_type_id,
      status: req.status,
      startDate: req.start_date,
      endDate: req.end_date,
      totalDays: req.total_days,
      partialDayType: req.partial_day_type || 'full',
      reason: req.reason,
      departmentId: emp?.department_id,
      departmentName: emp?.department_id ? deptMap[emp.department_id]?.name : null,
    };
  });

  // Get unique departments that have visible employees
  const visibleDepts = new Set();
  allEmployees.forEach(e => {
    if (visibleIds.has(e.id) && e.department_id) {
      visibleDepts.add(e.department_id);
    }
  });
  const departments = allDepartments.filter(d => visibleDepts.has(d.id));

  return {
    leave: normalizedLeave,
    employees: employeeMap,
    departments,
    visibleEmployeeIds: visibleIds,
  };
}

/**
 * Get personal leave for calendar display
 */
export async function getPersonalLeaveForCalendar(employeeId, startDate, endDate) {
  const leave = await LeaveRequest.filter({ employee_id: employeeId });
  
  return leave.filter(req => {
    if (req.status !== 'approved' && req.status !== 'pending') return false;
    if (req.end_date < startDate || req.start_date > endDate) return false;
    return true;
  }).map(req => ({
    id: req.id,
    employeeId: req.employee_id,
    leaveTypeId: req.leave_type_id,
    status: req.status,
    startDate: req.start_date,
    endDate: req.end_date,
    totalDays: req.total_days,
    partialDayType: req.partial_day_type || 'full',
    reason: req.reason,
  }));
}

/**
 * Build a date-indexed map of leave for fast calendar rendering
 */
export function buildLeaveDateMap(leaveRequests) {
  const dateMap = {};
  
  leaveRequests.forEach(leave => {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    
    // Iterate through each day of the leave
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = [];
      }
      
      dateMap[dateStr].push({
        ...leave,
        // For single-day leave, use the partial day type; for multi-day, always full
        isHalfDay: leave.startDate === leave.endDate && 
          (leave.partialDayType === 'half_am' || leave.partialDayType === 'half_pm'),
      });
    }
  });
  
  return dateMap;
}