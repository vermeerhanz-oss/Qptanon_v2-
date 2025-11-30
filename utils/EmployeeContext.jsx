import { base44 } from '@/api/base44Client';
import { getEffectiveEntityIdSync } from './entityHierarchy';
import { 
  isManager as checkIsManager, 
  canActAsAdmin, 
  getUserRole, 
  buildPermissions,
  canViewPeople,
  canViewSalary,
  canViewTeamTimeOff,
  canApproveLeaveGeneral,
  canManageOnboarding,
  canManageOffboarding,
  canViewReports,
  canManageCompanySettings,
  canManageEntities,
  canManagePolicies,
  isSensitiveFieldVisible
} from './permissions';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;
const CompanyEntity = base44.entities.CompanyEntity;
const UserPreferences = base44.entities.UserPreferences;
const LeaveBalance = base44.entities.LeaveBalance;

/**
 * EmployeeContext - Single source of truth for employee-related derived data
 * 
 * Provides a unified way to load and compute all relevant context for an employee,
 * including their effective entity, manager chain, direct reports, permissions, etc.
 */

// Cache for bulk data to avoid repeated fetches
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

async function loadBulkData(forceRefresh = false) {
  const now = Date.now();
  if (cachedData && !forceRefresh && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedData;
  }

  const [employees, departments, locations, entities] = await Promise.all([
    Employee.list(),
    Department.list(),
    Location.list(),
    CompanyEntity.list(),
  ]);

  cachedData = { employees, departments, locations, entities };
  cacheTimestamp = now;
  return cachedData;
}

/**
 * Clear the cached data (call after mutations)
 */
export function clearEmployeeContextCache() {
  cachedData = null;
  cacheTimestamp = 0;
}

/**
 * Get all employees in the reporting tree (direct + indirect reports)
 * 
 * @param {string} managerId - The manager's employee ID
 * @param {Array} allEmployees - All employees list
 * @returns {Array} All employees in the reporting tree
 */
function getReportingTree(managerId, allEmployees) {
  const result = [];
  const queue = [managerId];
  const visited = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const directReports = allEmployees.filter(
      e => e.manager_id === currentId && e.status !== 'terminated'
    );
    
    for (const report of directReports) {
      result.push(report);
      queue.push(report.id);
    }
  }

  return result;
}

/**
 * Get visible employees based on role
 * 
 * @param {Object} currentEmployee - Current user's employee record
 * @param {string} role - User's role ('staff', 'manager', 'admin', 'owner')
 * @param {Array} allEmployees - All employees list
 * @returns {Array} Employees visible to the user
 */
export function getVisibleEmployees(currentEmployee, role, allEmployees) {
  if (!currentEmployee) {
    // No employee record - if admin/owner, show all; otherwise empty
    if (role === 'admin' || role === 'owner') {
      return allEmployees.filter(e => e.status !== 'terminated');
    }
    return [];
  }

  switch (role) {
    case 'owner':
    case 'admin':
      // Can see all employees
      return allEmployees.filter(e => e.status !== 'terminated');

    case 'manager':
      // Can see self + all in reporting tree
      const reportingTree = getReportingTree(currentEmployee.id, allEmployees);
      return [currentEmployee, ...reportingTree];

    case 'staff':
    default:
      // Can only see self
      return [currentEmployee];
  }
}

/**
 * Get comprehensive context for an employee
 * 
 * @param {string} employeeId - The employee ID
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeLeaveBalances - Load leave balances
 * @param {boolean} options.includeManagerChain - Build full manager chain
 * @param {boolean} options.forceRefresh - Force refresh cached data
 * @returns {Promise<Object>} Employee context object
 */
export async function getEmployeeContext(employeeId, options = {}) {
  const { 
    includeLeaveBalances = false, 
    includeManagerChain = false,
    forceRefresh = false 
  } = options;

  const { employees, departments, locations, entities } = await loadBulkData(forceRefresh);

  const employee = employees.find(e => e.id === employeeId);
  if (!employee) {
    return null;
  }

  // Basic lookups
  const department = departments.find(d => d.id === employee.department_id) || null;
  const location = locations.find(l => l.id === employee.location_id) || null;
  const manager = employees.find(e => e.id === employee.manager_id) || null;

  // Effective entity (handles inheritance)
  const effectiveEntity = getEffectiveEntityIdSync(employeeId, employees, entities);
  const entity = entities.find(e => e.id === effectiveEntity.entityId) || null;

  // Direct reports
  const directReports = employees.filter(e => e.manager_id === employeeId && e.status !== 'terminated');

  // Is manager (has direct reports or is_manager flag)
  const isManagerFlag = employee.is_manager === true || directReports.length > 0;

  // Manager chain (if requested)
  let managerChain = [];
  if (includeManagerChain) {
    const visited = new Set([employeeId]);
    let currentManagerId = employee.manager_id;
    while (currentManagerId && !visited.has(currentManagerId)) {
      visited.add(currentManagerId);
      const mgr = employees.find(e => e.id === currentManagerId);
      if (mgr) {
        managerChain.push(mgr);
        currentManagerId = mgr.manager_id;
      } else {
        break;
      }
    }
  }

  // Leave balances (if requested)
  let leaveBalances = [];
  if (includeLeaveBalances) {
    leaveBalances = await LeaveBalance.filter({ employee_id: employeeId });
  }

  return {
    employee,
    department,
    location,
    entity,
    effectiveEntity,
    manager,
    managerChain,
    directReports,
    isManager: isManagerFlag,
    leaveBalances,
    // Convenience getters
    displayName: employee.preferred_name || employee.first_name,
    fullName: `${employee.first_name} ${employee.last_name}`,
  };
}

/**
 * Get context for the currently logged-in user's employee record
 * 
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} User and employee context
 */
export async function getCurrentUserEmployeeContext(options = {}) {
  const { forceRefresh = false, includeLeaveBalances = false, includeManagerChain = false } = options;

  const user = await base44.auth.me();
  
  const [{ employees, departments, locations, entities }, prefsResult] = await Promise.all([
    loadBulkData(forceRefresh),
    UserPreferences.filter({ user_id: user.id }),
  ]);

  const preferences = prefsResult[0] || { acting_mode: 'admin' };

  // Find employee by email or user_id
  const employee = employees.find(e => e.email === user.email || e.user_id === user.id);

  if (!employee) {
    // User has no employee record
    const role = getUserRole(null, user);
    const visibleEmployees = getVisibleEmployees(null, role, employees);
    
    const ctx = {
      user,
      preferences,
      employee: null,
      isAdmin: canActAsAdmin(user, preferences),
      isManager: checkIsManager(user, null, false),
      actingMode: preferences.acting_mode || 'admin',
      role,
      visibleEmployees,
      // Empty context
      department: null,
      location: null,
      entity: null,
      effectiveEntity: null,
      manager: null,
      managerChain: [],
      directReports: [],
      leaveBalances: [],
    };
    ctx.permissions = buildPermissions(ctx);
    return ctx;
  }

  // Get full employee context
  const employeeContext = await getEmployeeContext(employee.id, {
    includeLeaveBalances,
    includeManagerChain,
    forceRefresh: false, // Already loaded
  });

  // Check if user has direct reports (for manager detection)
  const hasDirectReports = employeeContext.directReports.length > 0;

  // Compute role and visible employees
  const role = getUserRole(employee, user);
  const visibleEmployees = getVisibleEmployees(employee, role, employees);

  const ctx = {
    user,
    preferences,
    ...employeeContext,
    isAdmin: canActAsAdmin(user, preferences),
    isManager: checkIsManager(user, employee, hasDirectReports),
    actingMode: preferences.acting_mode || 'admin',
    role,
    visibleEmployees,
  };
  
  // Add permissions object
  ctx.permissions = buildPermissions(ctx);
  
  return ctx;
}

/**
 * Get context for multiple employees efficiently
 * 
 * @param {Array<string>} employeeIds - Array of employee IDs
 * @param {Object} options - Optional configuration
 * @returns {Promise<Map<string, Object>>} Map of employee ID to context
 */
export async function getEmployeeContextBatch(employeeIds, options = {}) {
  const { forceRefresh = false } = options;
  await loadBulkData(forceRefresh);

  const results = new Map();
  for (const id of employeeIds) {
    const context = await getEmployeeContext(id, { ...options, forceRefresh: false });
    if (context) {
      results.set(id, context);
    }
  }
  return results;
}

/**
 * Build context for all employees (useful for bulk operations/reporting)
 * 
 * @param {Object} options - Optional configuration
 * @returns {Promise<Array<Object>>} Array of employee contexts
 */
export async function getAllEmployeeContexts(options = {}) {
  const { forceRefresh = false, statusFilter = null } = options;
  const { employees } = await loadBulkData(forceRefresh);

  let targetEmployees = employees;
  if (statusFilter) {
    targetEmployees = employees.filter(e => e.status === statusFilter);
  }

  const contexts = [];
  for (const emp of targetEmployees) {
    const context = await getEmployeeContext(emp.id, { ...options, forceRefresh: false });
    if (context) {
      contexts.push(context);
    }
  }
  return contexts;
}