import { base44 } from '@/api/base44Client';
import { recalcAllLeaveForEmployee } from '@/components/utils/LeaveEngine';
import { updateUserProfileForEmployee } from '@/components/utils/googleWorkspace';

const Employee = base44.entities.Employee;
const HRTask = base44.entities.HRTask;
const CompanyEntity = base44.entities.CompanyEntity;
const OffboardingInstance = base44.entities.OffboardingInstance;
const OffboardingTemplate = base44.entities.OffboardingTemplate;

/**
 * Profile Change Engine
 * Evaluates changes to employee profiles and triggers appropriate workflows
 */

export async function onProfileChange(employeeId, previousData, newData) {
  const changes = detectChanges(previousData, newData);
  const tasks = [];

  // Get entity info for context
  let entity = null;
  if (newData.entity_id) {
    const entities = await CompanyEntity.filter({ id: newData.entity_id });
    entity = entities[0];
  }

  // LOCATION CHANGE
  if (changes.location_id) {
    tasks.push({
      employee_id: employeeId,
      entity_id: newData.entity_id,
      category: 'relocation_compliance',
      title: 'Employee Relocation - Compliance Review',
      description: `Employee has moved to a new work location. Please review and confirm compliance requirements, and issue new employment agreement if necessary.`,
      priority: 'high',
      assigned_to_role: 'HR',
      trigger_event: 'location_change',
      due_date: getDateOffset(7),
    });

    // Notify IT for equipment/access changes
    tasks.push({
      employee_id: employeeId,
      entity_id: newData.entity_id,
      category: 'relocation_compliance',
      title: 'Employee Relocation - IT Setup',
      description: `Employee has moved to a new location. Review access permissions and equipment requirements.`,
      priority: 'medium',
      assigned_to_role: 'IT',
      trigger_event: 'location_change',
      due_date: getDateOffset(3),
    });
  }

  // ENTITY CHANGE (Transfer)
  if (changes.entity_id) {
    tasks.push({
      employee_id: employeeId,
      entity_id: newData.entity_id,
      category: 'entity_transfer',
      title: 'Entity Transfer - New Employment Agreement Required',
      description: `Employee transferred from entity. Generate new employment agreement for the receiving entity.`,
      priority: 'urgent',
      assigned_to_role: 'HR',
      trigger_event: 'entity_transfer',
      due_date: getDateOffset(5),
    });

    tasks.push({
      employee_id: employeeId,
      entity_id: newData.entity_id,
      category: 'entity_transfer',
      title: 'Entity Transfer - Compensation Currency Review',
      description: `Employee transferred to new entity. Review and confirm compensation currency and tax requirements.`,
      priority: 'high',
      assigned_to_role: 'HR',
      trigger_event: 'entity_transfer',
      due_date: getDateOffset(3),
    });

    tasks.push({
      employee_id: employeeId,
      entity_id: newData.entity_id,
      category: 'document_required',
      title: 'Entity Transfer - Document Requirements',
      description: `Employee transferred to new entity. Collect required documents for the new jurisdiction.`,
      priority: 'medium',
      assigned_to_role: 'HR',
      trigger_event: 'entity_transfer',
      due_date: getDateOffset(14),
    });
  }

  // ROLE OR DEPARTMENT CHANGE
  if (changes.job_title || changes.department_id) {
    const changeType = changes.job_title && changes.department_id 
      ? 'Role and Department' 
      : changes.job_title ? 'Role' : 'Department';

    tasks.push({
      employee_id: employeeId,
      entity_id: newData.entity_id,
      category: 'role_change',
      title: `${changeType} Change - Training Requirements`,
      description: `Employee's ${changeType.toLowerCase()} has changed. Review and assign any required training or certifications.`,
      priority: 'medium',
      assigned_to_role: 'HR',
      trigger_event: 'role_change',
      due_date: getDateOffset(14),
    });

    // Notify manager
    if (newData.manager_id) {
      tasks.push({
        employee_id: employeeId,
        entity_id: newData.entity_id,
        category: 'role_change',
        title: `${changeType} Change - Manager Review`,
        description: `Your direct report's ${changeType.toLowerCase()} has changed. Please review responsibilities and update goals if needed.`,
        priority: 'medium',
        assigned_to_role: 'MANAGER',
        assigned_to_user_id: newData.manager_id,
        trigger_event: 'role_change',
        due_date: getDateOffset(7),
      });
    }
  }

  // MANAGER CHANGE
  if (changes.manager_id) {
    // Notify old manager (handover)
    if (previousData.manager_id) {
      tasks.push({
        employee_id: employeeId,
        entity_id: newData.entity_id,
        category: 'manager_change',
        title: 'Direct Report Transfer - Handover Required',
        description: `${newData.first_name} ${newData.last_name} has been reassigned to a new manager. Please complete any necessary handover documentation.`,
        priority: 'medium',
        assigned_to_role: 'MANAGER',
        assigned_to_user_id: previousData.manager_id,
        trigger_event: 'manager_change',
        due_date: getDateOffset(3),
      });
    }

    // Notify new manager
    if (newData.manager_id) {
      tasks.push({
        employee_id: employeeId,
        entity_id: newData.entity_id,
        category: 'manager_change',
        title: 'New Direct Report Assigned',
        description: `${newData.first_name} ${newData.last_name} has been assigned as your direct report. Please schedule an introductory 1:1 meeting.`,
        priority: 'medium',
        assigned_to_role: 'MANAGER',
        assigned_to_user_id: newData.manager_id,
        trigger_event: 'manager_change',
        due_date: getDateOffset(3),
      });
    }
  }

  // STATUS CHANGE TO TERMINATED
  if (changes.status && newData.status === 'terminated') {
    await triggerOffboarding(employeeId, newData);
  }

  // STATUS CHANGE TO OFFBOARDING
  if (changes.status && newData.status === 'offboarding') {
    await triggerOffboarding(employeeId, newData);
  }

  // Create all HR tasks
  for (const task of tasks) {
    await HRTask.create(task);
  }

  // Check if any leave-affecting fields changed and trigger recalc
  const leaveFieldsChanged = LEAVE_ACCRUAL_FIELDS.some(field => changes[field]);
  if (leaveFieldsChanged) {
    try {
      await recalcAllLeaveForEmployee(employeeId);
    } catch (e) {
      console.error('Failed to recalc leave after profile change:', e);
    }
  }

  // Check if any Google-sync fields changed and sync to Google Workspace
  const googleSyncFieldsChanged = GOOGLE_SYNC_FIELDS.some(field => changes[field]);
  let googleSyncResult = null;
  if (googleSyncFieldsChanged) {
    googleSyncResult = await syncEmployeeToGoogle(employeeId, newData);
  }

  return {
    tasksCreated: tasks.length,
    changes,
    leaveRecalcTriggered: leaveFieldsChanged,
    googleSyncResult,
  };
}

/**
 * Detect which fields changed between previous and new data
 */
function detectChanges(previousData, newData) {
  const watchedFields = [
    'location_id',
    'entity_id',
    'job_title',
    'department_id',
    'manager_id',
    'status',
    'employment_type',
    'base_salary',
    'start_date',
    'service_start_date',
    'hours_per_week',
  ];

  const changes = {};
  for (const field of watchedFields) {
    if (previousData[field] !== newData[field]) {
      changes[field] = {
        from: previousData[field],
        to: newData[field],
      };
    }
  }
  return changes;
}

/**
 * Fields that affect leave accrual - trigger recalc when changed
 */
const LEAVE_ACCRUAL_FIELDS = [
  'start_date',
  'service_start_date',
  'hours_per_week',
  'employment_type',
  'entity_id',
];

/**
 * Fields that should sync to Google Workspace when changed
 */
const GOOGLE_SYNC_FIELDS = [
  'first_name',
  'last_name',
  'preferred_name',
  'job_title',
  'department_id',
  'manager_id',
  'location_id',
];

/**
 * Sync employee profile changes to Google Workspace
 */
async function syncEmployeeToGoogle(employeeId, employeeData) {
  // Check if employee has Google sync enabled and is linked
  if (employeeData.google_sync_enabled === false) {
    return { skipped: true, reason: 'sync_disabled' };
  }
  if (!employeeData.google_user_id) {
    return { skipped: true, reason: 'not_linked' };
  }

  try {
    const result = await updateUserProfileForEmployee(employeeData);
    return result;
  } catch (error) {
    console.error('Failed to sync employee to Google Workspace:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get date offset from today
 */
function getDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Trigger offboarding workflow
 */
async function triggerOffboarding(employeeId, employeeData) {
  // Check if offboarding already exists
  const existingInstances = await OffboardingInstance.filter({ 
    employee_id: employeeId,
    status: 'in_progress'
  });

  if (existingInstances.length > 0) {
    return; // Already has active offboarding
  }

  // Get default template
  const templates = await OffboardingTemplate.list();
  if (templates.length === 0) return;

  const template = templates[0];

  // Create offboarding instance
  await OffboardingInstance.create({
    employee_id: employeeId,
    template_id: template.id,
    status: 'in_progress',
    final_day: employeeData.termination_date || getDateOffset(14),
  });
}

/**
 * Update employee with change tracking
 */
export async function updateEmployeeWithTracking(employeeId, updates, currentUser) {
  // Get current data
  const employees = await Employee.filter({ id: employeeId });
  if (employees.length === 0) throw new Error('Employee not found');
  
  const previousData = employees[0];
  
  // Apply updates
  await Employee.update(employeeId, updates);
  
  // Get updated data
  const updatedEmployees = await Employee.filter({ id: employeeId });
  const newData = updatedEmployees[0];
  
  // Trigger change engine
  const result = await onProfileChange(employeeId, previousData, newData);
  
  return {
    employee: newData,
    changeResult: result,
  };
}

/**
 * Resolve assigned user based on role and employee context
 */
export async function resolveAssignedUser(role, employee, entity) {
  switch (role) {
    case 'MANAGER':
      return employee.manager_id || null;
    case 'HR':
      return entity?.hr_contact_id || null;
    case 'IT':
      return entity?.it_contact_id || null;
    case 'EMPLOYEE':
      return employee.user_id || null;
    default:
      return null;
  }
}

/**
 * Get entity for employee
 */
export async function getEmployeeEntity(employeeId) {
  const employees = await Employee.filter({ id: employeeId });
  if (employees.length === 0 || !employees[0].entity_id) return null;
  
  const entities = await CompanyEntity.filter({ id: employees[0].entity_id });
  return entities[0] || null;
}