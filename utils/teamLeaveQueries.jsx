import { base44 } from '@/api/base44Client';
import { getVisibleEmployeeIdsForLeave } from './permissions';

const LeaveRequest = base44.entities.LeaveRequest;
const Employee = base44.entities.Employee;

/**
 * Team Leave Queries
 * 
 * Optimized queries for fetching team leave data in a single batch,
 * avoiding N+1 performance issues.
 */

/**
 * Get all team leave for a date range.
 * Fetches ALL leave in one query, then filters by visible employees.
 * 
 * @param {Object} params
 * @param {string} params.startDate - Start date (yyyy-MM-dd)
 * @param {string} params.endDate - End date (yyyy-MM-dd)
 * @param {Object} params.user - Current user object
 * @param {Object} params.currentEmployee - Current user's employee record
 * @param {Object} params.preferences - User preferences with acting_mode
 * @param {Array} [params.statusFilter] - Status values to include (default: ['approved', 'pending'])
 * @returns {Promise<Array>} Array of leave requests with employee info
 */
export async function getAllTeamLeave({
  startDate,
  endDate,
  user,
  currentEmployee,
  preferences,
  statusFilter = ['approved', 'pending'],
}) {
  // Fetch all employees and leave requests in parallel
  const [allEmployees, allLeave] = await Promise.all([
    Employee.filter({ status: 'active' }),
    LeaveRequest.list(),
  ]);

  // Determine visible employee IDs based on role
  const visibleIds = getVisibleEmployeeIdsForLeave(
    user,
    currentEmployee,
    preferences,
    allEmployees
  );

  // Filter leave by:
  // 1. Status is in statusFilter
  // 2. Employee is in visible list
  // 3. Date range overlaps
  const filteredLeave = allLeave.filter(req => {
    if (!statusFilter.includes(req.status)) return false;
    if (!visibleIds.has(req.employee_id)) return false;
    // Date overlap: req.end_date >= startDate AND req.start_date <= endDate
    if (req.end_date < startDate || req.start_date > endDate) return false;
    return true;
  });

  // Build employee lookup map
  const employeeMap = {};
  allEmployees.forEach(e => { employeeMap[e.id] = e; });

  // Enrich leave with employee info
  const enrichedLeave = filteredLeave.map(req => ({
    ...req,
    employee: employeeMap[req.employee_id] || null,
  }));

  return enrichedLeave;
}

/**
 * Get leave requests for the calendar view.
 * Optimized for calendar display with employee info included.
 * 
 * @param {Object} params
 * @param {number} params.year - Year to fetch
 * @param {Object} params.user - Current user object
 * @param {Object} params.currentEmployee - Current user's employee record
 * @param {Object} params.preferences - User preferences with acting_mode
 * @param {boolean} params.isTeamView - Whether this is team view or personal view
 * @returns {Promise<{leave: Array, employees: Object}>} Leave requests and employee map
 */
export async function getCalendarLeave({
  year,
  user,
  currentEmployee,
  preferences,
  isTeamView = false,
}) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  if (!isTeamView && currentEmployee) {
    // Personal view: just fetch own leave
    const myLeave = await LeaveRequest.filter({ employee_id: currentEmployee.id });
    const filteredLeave = myLeave.filter(req => {
      if (req.status !== 'approved' && req.status !== 'pending') return false;
      if (req.end_date < startDate || req.start_date > endDate) return false;
      return true;
    });
    return {
      leave: filteredLeave,
      employees: { [currentEmployee.id]: currentEmployee },
    };
  }

  // Team view
  const enrichedLeave = await getAllTeamLeave({
    startDate,
    endDate,
    user,
    currentEmployee,
    preferences,
  });

  // Build employee map from enriched leave
  const employees = {};
  enrichedLeave.forEach(req => {
    if (req.employee) {
      employees[req.employee_id] = req.employee;
    }
  });

  return {
    leave: enrichedLeave,
    employees,
  };
}

/**
 * Get direct reports' leave requests for a manager.
 * 
 * @param {string} managerId - Manager's employee ID
 * @param {Object} options
 * @param {string} [options.status] - Filter by status
 * @returns {Promise<Array>} Leave requests for direct reports
 */
export async function getDirectReportsLeave(managerId, options = {}) {
  const { status } = options;

  // Get direct reports
  const directReports = await Employee.filter({ manager_id: managerId, status: 'active' });
  const reportIds = new Set(directReports.map(e => e.id));

  if (reportIds.size === 0) {
    return [];
  }

  // Get all leave
  const allLeave = await LeaveRequest.list();

  // Filter to direct reports
  let filtered = allLeave.filter(req => reportIds.has(req.employee_id));

  // Apply status filter if provided
  if (status) {
    filtered = filtered.filter(req => req.status === status);
  }

  // Build employee map
  const employeeMap = {};
  directReports.forEach(e => { employeeMap[e.id] = e; });

  // Enrich with employee info
  return filtered.map(req => ({
    ...req,
    employee: employeeMap[req.employee_id] || null,
  }));
}