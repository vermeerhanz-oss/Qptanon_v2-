/**
 * HRIS Permissions Utility
 * 
 * Centralized role-based access control for the SimplePeople HRIS app.
 * All functions are pure and return booleans.
 * 
 * Acting Mode:
 *   - Admins can switch between 'admin' and 'staff' mode
 *   - In 'staff' mode, admins are restricted to self-only operations
 *   - Pass userPreferences with acting_mode to permission functions
 * 
 * Usage:
 *   import { canEditEmployee, canApproveLeave, isActingAsAdmin } from '@/components/utils/permissions';
 *   
 *   if (canEditEmployee(user, employee, currentEmployee, preferences)) {
 *     // show edit form
 *   }
 */

// ============================================
// Role Resolution
// ============================================

/**
 * Get the effective role for a user/employee
 * @param {Object} employee - Employee record
 * @param {Object} user - User record (optional)
 * @returns {'staff'|'manager'|'admin'|'owner'}
 */
export function getUserRole(employee, user = null) {
  // Check user role first
  if (user?.role === 'owner') return 'owner';
  if (user?.role === 'admin') return 'admin';
  
  // Check employee flags
  if (employee?.is_owner) return 'owner';
  if (employee?.is_admin) return 'admin';
  if (employee?.is_manager) return 'manager';
  
  return 'staff';
}

// ============================================
// Acting Mode Helpers
// ============================================

/**
 * Check if user is acting as admin (has admin role AND acting_mode is 'admin')
 * @param {Object} user - User object with role property
 * @param {Object} preferences - UserPreferences object with acting_mode
 * @returns {boolean}
 */
export function isActingAsAdmin(user, preferences) {
  if (!user || !['admin', 'owner'].includes(user.role)) return false;
  // Default to 'admin' mode if no preference set
  const actingMode = preferences?.acting_mode || 'admin';
  return actingMode === 'admin';
}

/**
 * Check if user is in staff mode (admin but acting as staff)
 * @param {Object} user - User object with role property
 * @param {Object} preferences - UserPreferences object with acting_mode
 * @returns {boolean}
 */
export function isInStaffMode(user, preferences) {
  if (!user || !['admin', 'owner'].includes(user.role)) return false;
  return preferences?.acting_mode === 'staff';
}

// ============================================
// Role Checkers
// ============================================

/**
 * Check if user is an admin (role only, does not consider acting_mode)
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export function isAdmin(user) {
  return user?.role === 'admin';
}

/**
 * Check if user has the manager role
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export function hasManagerRole(user) {
  return user?.role === 'manager';
}

/**
 * Check if user is a manager (has direct reports or is_manager flag)
 * This is a synchronous check based on pre-loaded data.
 * For async check with DB lookup, use isManagerAsync.
 * 
 * @param {Object} user - User object with role property
 * @param {Object} currentEmployee - Current user's employee record (optional)
 * @param {boolean} hasDirectReports - Whether user has direct reports (pre-computed)
 * @returns {boolean}
 */
export function isManager(user, currentEmployee = null, hasDirectReports = false) {
  // Check explicit manager role
  if (user?.role === 'manager') return true;
  
  // Check is_manager flag on employee record
  if (currentEmployee?.is_manager === true) return true;
  
  // Check if has direct reports (must be pre-computed and passed in)
  if (hasDirectReports) return true;
  
  return false;
}

/**
 * Check if user is a regular employee
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export function isEmployee(user) {
  return user?.role === 'employee';
}

/**
 * Check if user is at least a manager (admin or manager role)
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export function isManagerOrAbove(user) {
  return isAdmin(user) || hasManagerRole(user);
}

/**
 * Check if user has effective admin powers (admin role + admin mode)
 * Use this for permission checks instead of isAdmin() when acting_mode matters
 * @param {Object} user - User object with role property
 * @param {Object} preferences - UserPreferences object with acting_mode
 * @returns {boolean}
 */
export function hasAdminPowers(user, preferences) {
  return isActingAsAdmin(user, preferences);
}

/**
 * Check if user can act as admin (convenience alias)
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canActAsAdmin(user, preferences) {
  return user?.role === 'admin' && (preferences?.acting_mode || 'admin') === 'admin';
}

/**
 * Check if user can act on a specific employee (edit, manage, etc.)
 * @param {string} targetEmployeeId - The employee ID to act on
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canActOnEmployee(targetEmployeeId, user, currentEmployee, preferences) {
  // Admin mode: full access
  if (canActAsAdmin(user, preferences)) return true;
  
  // Staff mode or non-admin: only on own profile
  return currentEmployee?.id === targetEmployeeId;
}

// ============================================
// Employee Permissions
// ============================================

/**
 * Check if user can view an employee's profile
 * @param {Object} user - Current user
 * @param {Object} employee - Target employee record
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewEmployee(user, employee, currentEmployee, preferences) {
  if (!user || !employee) return false;
  
  // Admin in admin mode: can view anyone
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode OR Manager: check if viewing own or as manager
  if (isInStaffMode(user, preferences)) {
    return currentEmployee?.id === employee.id;
  }
  
  // Manager: can view anyone (for now)
  if (hasManagerRole(user)) return true;
  
  // Employee: can only view themselves
  return currentEmployee?.id === employee.id;
}

/**
 * Check if user can edit an employee's profile
 * @param {Object} user - Current user
 * @param {Object} employee - Target employee record
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canEditEmployee(user, employee, currentEmployee, preferences) {
  if (!user || !employee) return false;
  
  // Admin in admin mode: full edit access
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: can only edit their own limited fields
  if (isInStaffMode(user, preferences)) {
    return currentEmployee?.id === employee.id;
  }
  
  // Manager: no edit access for MVP
  if (isManager(user)) return false;
  
  // Employee: can only edit their own limited fields
  return currentEmployee?.id === employee.id;
}

/**
 * Get the fields an employee can edit on their own profile
 * @returns {string[]} Array of editable field names
 */
export function getEmployeeSelfEditableFields() {
  return ['preferred_name', 'personal_email', 'phone', 'notes'];
}

/**
 * Check if a specific field can be edited by the user
 * @param {Object} user - Current user
 * @param {Object} employee - Target employee record
 * @param {Object} currentEmployee - Current user's employee record
 * @param {string} fieldName - Name of the field to check
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canEditEmployeeField(user, employee, currentEmployee, fieldName, preferences) {
  if (!user || !employee) return false;
  
  // Admin in admin mode: can edit any field
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode or employee editing their own record: only specific fields
  if (currentEmployee?.id === employee.id) {
    return getEmployeeSelfEditableFields().includes(fieldName);
  }
  
  return false;
}

// ============================================
// Leave Request Permissions
// ============================================

/**
 * Check if user can view a leave request
 * @param {Object} user - Current user
 * @param {Object} leaveRequest - Leave request with employee_id and manager_id
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewLeaveRequest(user, leaveRequest, currentEmployee, preferences) {
  if (!user || !leaveRequest) return false;
  
  // Admin in admin mode: can view all
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: can only view their own
  if (isInStaffMode(user, preferences)) {
    return leaveRequest.employee_id === currentEmployee?.id;
  }
  
  // Manager: can view if they are the assigned manager OR if the employee reports to them
  if (currentEmployee?.is_manager && currentEmployee) {
    return leaveRequest.manager_id === currentEmployee.id || 
           leaveRequest.employee_id === currentEmployee.id;
  }
  
  // Employee: can view their own requests
  return currentEmployee && leaveRequest.employee_id === currentEmployee.id;
}

/**
 * Check if user can view leave for a specific employee
 * Used when loading leave history or calendar for another employee.
 * 
 * @param {Object} user - Current user
 * @param {Object} targetEmployee - The employee whose leave we want to view
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewEmployeeLeave(user, targetEmployee, currentEmployee, preferences) {
  if (!user || !targetEmployee) return false;
  
  // Admin in admin mode: can view all
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: can only view their own
  if (isInStaffMode(user, preferences)) {
    return targetEmployee.id === currentEmployee?.id;
  }
  
  // Manager: can view if they manage this employee (direct report)
  if (currentEmployee?.is_manager && currentEmployee) {
    return targetEmployee.manager_id === currentEmployee.id || 
           targetEmployee.id === currentEmployee.id;
  }
  
  // Employee: can view only their own leave
  return currentEmployee && targetEmployee.id === currentEmployee.id;
}

/**
 * Check if user can manage leave for a specific employee (create on behalf, etc.)
 * 
 * @param {Object} user - Current user
 * @param {Object} targetEmployee - The employee to manage leave for
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageEmployeeLeave(user, targetEmployee, currentEmployee, preferences) {
  if (!user || !targetEmployee) return false;
  
  // Admin in admin mode: can manage all
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: cannot manage others
  if (isInStaffMode(user, preferences)) return false;
  
  // Manager: can manage if they manage this employee (direct report)
  if (currentEmployee?.is_manager && currentEmployee) {
    return targetEmployee.manager_id === currentEmployee.id;
  }
  
  return false;
}

/**
 * Check if user can approve/decline a leave request
 * @param {Object} user - Current user
 * @param {Object} leaveRequest - Leave request with manager_id
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canApproveLeave(user, leaveRequest, currentEmployee, preferences) {
  if (!user || !leaveRequest) return false;
  
  // Admin in admin mode: can approve any request
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: cannot approve (treated as regular employee)
  if (isInStaffMode(user, preferences)) return false;
  
  // Manager: can approve ONLY if they are the assigned manager OR have is_manager flag
  if (currentEmployee?.is_manager && currentEmployee) {
    return leaveRequest.manager_id === currentEmployee.id;
  }
  
  // Employee: cannot approve
  return false;
}

/**
 * Check if user can create a leave request for an employee
 * @param {Object} user - Current user
 * @param {Object} targetEmployee - Employee the request is for
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canCreateLeaveRequest(user, targetEmployee, currentEmployee, preferences) {
  if (!user || !targetEmployee) return false;
  
  // Admin in admin mode: can create for anyone
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode or employee: can create for themselves only
  if (currentEmployee) {
    return targetEmployee.id === currentEmployee.id;
  }
  
  return false;
}

/**
 * LeaveRequest Status Values (from entity schema)
 * 
 * Canonical status strings used in LeaveRequest.status:
 * - 'pending'   - Awaiting manager approval
 * - 'approved'  - Approved by manager (or auto-approved)
 * - 'declined'  - Declined by manager
 * - 'cancelled' - Cancelled/recalled by employee or admin
 */
export const LEAVE_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

/**
 * Check if user can cancel/recall a leave request
 * 
 * Rules:
 * - Pending requests: can be cancelled by owner or admin
 * - Approved, future-dated requests: can be recalled by owner or admin
 * - Started or past leave: cannot be cancelled
 * - Declined/cancelled: cannot be cancelled again
 * 
 * @param {Object} user - Current user
 * @param {Object} leaveRequest - Leave request to cancel
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canCancelLeaveRequest(user, leaveRequest, currentEmployee, preferences) {
  if (!user || !leaveRequest) {
    console.log('[canCancelLeaveRequest] Missing user or leaveRequest', { user: !!user, leaveRequest: !!leaveRequest });
    return false;
  }
  
  const isAdmin = hasAdminPowers(user, preferences);
  const isSelf = currentEmployee && leaveRequest.employee_id === currentEmployee.id;
  
  // Get today's date as yyyy-MM-dd string
  const today = new Date().toISOString().split('T')[0];
  
  const status = leaveRequest.status;
  const startDate = leaveRequest.start_date;
  
  console.log('[canCancelLeaveRequest] Checking', { 
    status, 
    startDate, 
    today, 
    isAdmin, 
    isSelf,
    employeeId: leaveRequest.employee_id,
    currentEmployeeId: currentEmployee?.id
  });
  
  // Case A: Pending requests - can be cancelled by owner or admin
  if (status === LEAVE_REQUEST_STATUS.PENDING) {
    const allowed = isAdmin || isSelf;
    console.log('[canCancelLeaveRequest] Pending request, allowed:', allowed);
    return allowed;
  }
  
  // Case B: Approved, future-dated requests (recall) - start_date must be today or later
  if (status === LEAVE_REQUEST_STATUS.APPROVED) {
    const isFuture = startDate >= today;
    const allowed = isFuture && (isAdmin || isSelf);
    console.log('[canCancelLeaveRequest] Approved request', { isFuture, allowed });
    return allowed;
  }
  
  // All other cases: declined, cancelled, or already started - cannot cancel
  console.log('[canCancelLeaveRequest] Not cancellable, status:', status);
  return false;
}

// ============================================
// Onboarding Permissions
// ============================================

/**
 * Check if user can view an onboarding instance
 * @param {Object} user - Current user
 * @param {Object} onboardingInstance - Instance with employee_id
 * @param {Object} instanceEmployee - The employee being onboarded
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewOnboardingInstance(user, onboardingInstance, instanceEmployee, currentEmployee, preferences) {
  if (!user || !onboardingInstance) return false;
  
  // Admin in admin mode: can view all
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: can only view their own onboarding
  if (isInStaffMode(user, preferences)) {
    return currentEmployee && onboardingInstance.employee_id === currentEmployee.id;
  }
  
  // Manager: can view if they are the employee's manager
  if (hasManagerRole(user) && currentEmployee && instanceEmployee) {
    return instanceEmployee.manager_id === currentEmployee.id;
  }
  
  // Employee: can view their own onboarding
  if (currentEmployee) {
    return onboardingInstance.employee_id === currentEmployee.id;
  }
  
  return false;
}

/**
 * Check if user can update an onboarding task
 * @param {Object} user - Current user
 * @param {Object} onboardingTask - Task with assignee_employee_id
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canUpdateOnboardingTask(user, onboardingTask, currentEmployee, preferences) {
  if (!user || !onboardingTask) return false;
  
  // Admin in admin mode: can update any task
  if (hasAdminPowers(user, preferences)) return true;
  
  // Any user (or admin in staff mode): can update if they are the assigned employee
  if (currentEmployee && onboardingTask.assignee_employee_id) {
    return onboardingTask.assignee_employee_id === currentEmployee.id;
  }
  
  return false;
}

/**
 * Check if user can create onboarding instances
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canCreateOnboarding(user, preferences) {
  return hasAdminPowers(user, preferences);
}

// ============================================
// Document Permissions
// ============================================

/**
 * Check if user can view a document
 * @param {Object} user - Current user
 * @param {Object} document - Document with optional employee_id
 * @param {Object} documentEmployee - The employee the document belongs to (if any)
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewDocument(user, document, documentEmployee, currentEmployee, preferences) {
  if (!user || !document) return false;
  
  // Company-wide document (no employee): all authenticated users can view
  if (!document.employee_id) {
    return true;
  }
  
  // Employee-specific document
  // Admin in admin mode: can view all
  if (hasAdminPowers(user, preferences)) return true;
  
  // Admin in staff mode: only their own documents
  if (isInStaffMode(user, preferences)) {
    return currentEmployee && document.employee_id === currentEmployee.id;
  }
  
  // Manager: can view if they are the employee's manager
  if (hasManagerRole(user) && currentEmployee && documentEmployee) {
    return documentEmployee.manager_id === currentEmployee.id;
  }
  
  // Employee: can only view their own documents
  if (currentEmployee) {
    return document.employee_id === currentEmployee.id;
  }
  
  return false;
}

/**
 * Check if user can upload documents
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canUploadDocument(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can delete a document
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canDeleteDocument(user, preferences) {
  return hasAdminPowers(user, preferences);
}

// ============================================
// Policy Acknowledgement Permissions
// ============================================

/**
 * Check if user can acknowledge a policy document
 * @param {Object} user - Current user
 * @param {Object} document - Policy document
 * @param {Object} currentEmployee - Current user's employee record
 * @returns {boolean}
 */
export function canAcknowledgePolicy(user, document, currentEmployee) {
  if (!user || !document) return false;
  
  // Can only acknowledge company-wide policies (no employee_id)
  if (document.employee_id) return false;
  
  // Must be an employee to acknowledge
  return !!currentEmployee;
}

// ============================================
// Settings/Admin Permissions
// ============================================

/**
 * Check if user can manage departments
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageDepartments(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can manage locations
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageLocations(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can manage leave types
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageLeaveTypes(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can manage onboarding templates
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageOnboardingTemplates(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can view leave approvals page
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {Object} currentEmployee - Current user's employee record (optional)
 * @param {boolean} hasDirectReports - Whether user has direct reports (pre-computed)
 * @returns {boolean}
 */
export function canViewLeaveApprovals(user, preferences, currentEmployee = null, hasDirectReports = false) {
  // Admin in admin mode: can view
  if (hasAdminPowers(user, preferences)) return true;
  
  // Staff mode: no access to approvals
  if (isInStaffMode(user, preferences)) return false;
  
  // Check if user is a manager (role, flag, or has reports) AND in admin mode
  const actingMode = preferences?.acting_mode || 'admin';
  if (actingMode === 'admin' && isManager(user, currentEmployee, hasDirectReports)) {
    return true;
  }
  
  return false;
}

/**
 * Check if user can view policy summary (admin view)
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewPolicySummary(user, preferences) {
  return hasAdminPowers(user, preferences);
}

// ============================================
// Leave Balance Permissions
// ============================================

/**
 * Check if user can view a leave balance
 * @param {Object} user - Current user
 * @param {Object} leaveBalance - Balance with employee_id
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewLeaveBalance(user, leaveBalance, currentEmployee, preferences) {
  if (!user || !leaveBalance) return false;
  
  // Admin in admin mode: can view all
  if (hasAdminPowers(user, preferences)) return true;
  
  // Employee or admin in staff mode: can view their own balance
  if (currentEmployee) {
    return leaveBalance.employee_id === currentEmployee.id;
  }
  
  return false;
}

/**
 * Check if user can modify leave balances
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canModifyLeaveBalance(user, preferences) {
  return hasAdminPowers(user, preferences);
}

// ============================================
// Unified Permission Checks
// ============================================

/**
 * Check if user can view people/employees
 * @param {Object} user - Current user
 * @returns {boolean}
 */
export function canViewPeople(user) {
  return !!user; // All authenticated users can view basic info
}

/**
 * Check if user can view salary information
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canViewSalary(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can view team time off / team calendar
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {boolean} hasDirectReports - Whether user has direct reports
 * @returns {boolean}
 */
export function canViewTeamTimeOff(user, currentEmployee, preferences, hasDirectReports = false) {
  if (hasAdminPowers(user, preferences)) return true;
  const actingMode = preferences?.acting_mode || 'admin';
  if (actingMode === 'admin' && isManager(user, currentEmployee, hasDirectReports)) return true;
  return false;
}

/**
 * Check if user can approve leave requests (general check)
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {boolean} hasDirectReports - Whether user has direct reports
 * @returns {boolean}
 */
export function canApproveLeaveGeneral(user, currentEmployee, preferences, hasDirectReports = false) {
  if (hasAdminPowers(user, preferences)) return true;
  const actingMode = preferences?.acting_mode || 'admin';
  if (actingMode === 'admin' && isManager(user, currentEmployee, hasDirectReports)) return true;
  return false;
}

/**
 * Check if user can manage onboarding
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {boolean} hasDirectReports - Whether user has direct reports
 * @returns {boolean}
 */
export function canManageOnboarding(user, currentEmployee, preferences, hasDirectReports = false) {
  if (hasAdminPowers(user, preferences)) return true;
  const actingMode = preferences?.acting_mode || 'admin';
  if (actingMode === 'admin' && isManager(user, currentEmployee, hasDirectReports)) return true;
  return false;
}

/**
 * Check if user can manage offboarding
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {boolean} hasDirectReports - Whether user has direct reports
 * @returns {boolean}
 */
export function canManageOffboarding(user, currentEmployee, preferences, hasDirectReports = false) {
  if (hasAdminPowers(user, preferences)) return true;
  const actingMode = preferences?.acting_mode || 'admin';
  if (actingMode === 'admin' && isManager(user, currentEmployee, hasDirectReports)) return true;
  return false;
}

/**
 * Check if user can view reports
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {boolean} hasDirectReports - Whether user has direct reports
 * @returns {boolean}
 */
export function canViewReports(user, currentEmployee, preferences, hasDirectReports = false) {
  if (hasAdminPowers(user, preferences)) return true;
  const actingMode = preferences?.acting_mode || 'admin';
  if (actingMode === 'admin' && isManager(user, currentEmployee, hasDirectReports)) return true;
  return false;
}

/**
 * Check if user can manage company settings
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageCompanySettings(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can manage entities
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManageEntities(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if user can manage policies
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function canManagePolicies(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Check if a sensitive field (salary, comp, ESOP) should be visible
 * @param {Object} user - Current user
 * @param {Object} preferences - UserPreferences with acting_mode
 * @returns {boolean}
 */
export function isSensitiveFieldVisible(user, preferences) {
  return hasAdminPowers(user, preferences);
}

/**
 * Build a permissions object for the current context
 * @param {Object} context - Employee context from getCurrentUserEmployeeContext
 * @returns {Object} Permissions object with all boolean flags
 */
export function buildPermissions(context) {
  const { user, employee, preferences, isManager: hasReports } = context;
  
  return {
    canViewPeople: canViewPeople(user),
    canViewSalary: canViewSalary(user, preferences),
    canViewTeamTimeOff: canViewTeamTimeOff(user, employee, preferences, hasReports),
    canApproveLeave: canApproveLeaveGeneral(user, employee, preferences, hasReports),
    canManageOnboarding: canManageOnboarding(user, employee, preferences, hasReports),
    canManageOffboarding: canManageOffboarding(user, employee, preferences, hasReports),
    canViewReports: canViewReports(user, employee, preferences, hasReports),
    canManageCompanySettings: canManageCompanySettings(user, preferences),
    canManageEntities: canManageEntities(user, preferences),
    canCreateOnboarding: canCreateOnboarding(user, preferences),
    canUploadDocument: canUploadDocument(user, preferences),
    canDeleteDocument: canDeleteDocument(user, preferences),
    canModifyLeaveBalance: canModifyLeaveBalance(user, preferences),
    canManageDepartments: canManageDepartments(user, preferences),
    canManageLocations: canManageLocations(user, preferences),
    canManageLeaveTypes: canManageLeaveTypes(user, preferences),
    canManageOnboardingTemplates: canManageOnboardingTemplates(user, preferences),
    canManagePolicies: canManagePolicies(user, preferences),
    isSensitiveFieldVisible: isSensitiveFieldVisible(user, preferences),
  };
}

/**
 * Get visible employee IDs for leave operations based on user context
 * 
 * @param {Object} user - Current user
 * @param {Object} currentEmployee - Current user's employee record
 * @param {Object} preferences - UserPreferences with acting_mode
 * @param {Array} allEmployees - All employees in the system
 * @returns {Set<string>} Set of employee IDs the user can view leave for
 */
export function getVisibleEmployeeIdsForLeave(user, currentEmployee, preferences, allEmployees) {
  if (!user || !allEmployees) return new Set();
  
  // Admin in admin mode: can see all
  if (hasAdminPowers(user, preferences)) {
    return new Set(allEmployees.map(e => e.id));
  }
  
  // Manager: can see self + direct reports
  if (currentEmployee?.is_manager && currentEmployee) {
    const visibleIds = new Set([currentEmployee.id]);
    allEmployees.forEach(e => {
      if (e.manager_id === currentEmployee.id) {
        visibleIds.add(e.id);
      }
    });
    return visibleIds;
  }
  
  // Employee: can only see self
  if (currentEmployee) {
    return new Set([currentEmployee.id]);
  }
  
  return new Set();
}