/**
 * AI Assistant Command Executor
 * 
 * Executes validated commands against the HRIS data layer.
 * This is a pure internal API - no LLM or UI dependencies.
 */

import { base44 } from '@/api/base44Client';
import { COMMAND_TYPES, validateCommandPayload } from './commandTypes';

const CompanyEntity = base44.entities.CompanyEntity;
const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;

/**
 * Check if context has required permission
 */
function checkPermission(context, permissionKey) {
  if (!context?.permissions) return false;
  return context.permissions[permissionKey] === true;
}

/**
 * Execute an assistant command
 * @param {{ type: string, payload: Object }} command
 * @param {Object} context - Employee context with permissions
 * @returns {Promise<{ success: boolean, message?: string, data?: Object, error?: string }>}
 */
export async function executeCommand(command, context = null) {
  const { type, payload } = command;

  // Validate payload
  const validation = validateCommandPayload(type, payload);
  if (!validation.valid) {
    return {
      success: false,
      error: `Validation failed: ${validation.errors.join('; ')}`,
    };
  }

  // Permission checks based on command type
  if (type === COMMAND_TYPES.CREATE_ENTITY) {
    if (!checkPermission(context, 'canManageEntities')) {
      return { success: false, error: 'Permission denied: Cannot create entities' };
    }
  }
  
  if (type === COMMAND_TYPES.ADD_EMPLOYEE) {
    if (!checkPermission(context, 'canManageOnboarding')) {
      return { success: false, error: 'Permission denied: Cannot add employees' };
    }
  }
  
  if (type === COMMAND_TYPES.CHANGE_REPORTING_LINE) {
    if (!checkPermission(context, 'canManageCompanySettings')) {
      return { success: false, error: 'Permission denied: Cannot change reporting lines' };
    }
  }

  // Route to appropriate handler
  switch (type) {
    case COMMAND_TYPES.CREATE_ENTITY:
      return await handleCreateEntity(payload);
    case COMMAND_TYPES.ADD_EMPLOYEE:
      return await handleAddEmployee(payload);
    case COMMAND_TYPES.CHANGE_REPORTING_LINE:
      return await handleChangeReportingLine(payload);
    default:
      return { success: false, error: `Unknown command type: ${type}` };
  }
}

/**
 * Create a new company entity
 */
async function handleCreateEntity(payload) {
  const { name, country, abbreviation, timezone } = payload;

  // Check for duplicate
  const existing = await CompanyEntity.filter({ name });
  if (existing.length > 0) {
    return { success: false, error: `Entity "${name}" already exists` };
  }

  const entity = await CompanyEntity.create({
    name,
    country,
    abbreviation: abbreviation || null,
    timezone: timezone || 'UTC',
    status: 'active',
  });

  return {
    success: true,
    message: `Created entity "${name}" in ${country}`,
    data: entity,
  };
}

/**
 * Add a new employee
 */
async function handleAddEmployee(payload) {
  const {
    first_name,
    last_name,
    work_email,
    role_title,
    department,
    entity_name,
    manager_email,
    location_name,
    employment_type,
    start_date,
  } = payload;

  // Check for duplicate email
  const existingEmps = await Employee.filter({ email: work_email });
  if (existingEmps.length > 0) {
    return { success: false, error: `Employee with email "${work_email}" already exists` };
  }

  // Resolve department
  let departmentId = null;
  const departments = await Department.filter({ name: department });
  if (departments.length > 0) {
    departmentId = departments[0].id;
  } else {
    // Create department if it doesn't exist
    const newDept = await Department.create({ name: department });
    departmentId = newDept.id;
  }

  // Resolve entity (optional)
  let entityId = null;
  if (entity_name) {
    const entities = await CompanyEntity.filter({ name: entity_name });
    if (entities.length > 0) {
      entityId = entities[0].id;
    } else {
      return { success: false, error: `Entity "${entity_name}" not found` };
    }
  }

  // Resolve manager (optional)
  let managerId = null;
  if (manager_email) {
    const managers = await Employee.filter({ email: manager_email });
    if (managers.length > 0) {
      managerId = managers[0].id;
    } else {
      return { success: false, error: `Manager with email "${manager_email}" not found` };
    }
  }

  // Resolve location (optional)
  let locationId = null;
  if (location_name) {
    const locations = await Location.filter({ name: location_name });
    if (locations.length > 0) {
      locationId = locations[0].id;
    }
    // Don't fail if location not found, just leave null
  }

  const employee = await Employee.create({
    first_name,
    last_name,
    email: work_email,
    job_title: role_title,
    department_id: departmentId,
    entity_id: entityId,
    manager_id: managerId,
    location_id: locationId,
    employment_type: employment_type || 'full_time',
    start_date: start_date || new Date().toISOString().split('T')[0],
    status: 'active',
  });

  return {
    success: true,
    message: `Added employee ${first_name} ${last_name} (${work_email}) as ${role_title}`,
    data: employee,
  };
}

/**
 * Change an employee's reporting line
 */
async function handleChangeReportingLine(payload) {
  const { employee_email, new_manager_email } = payload;

  // Find employee
  const employees = await Employee.filter({ email: employee_email });
  if (employees.length === 0) {
    return { success: false, error: `Employee with email "${employee_email}" not found` };
  }
  const employee = employees[0];

  // Find new manager
  const managers = await Employee.filter({ email: new_manager_email });
  if (managers.length === 0) {
    return { success: false, error: `Manager with email "${new_manager_email}" not found` };
  }
  const newManager = managers[0];

  // Prevent self-assignment
  if (employee.id === newManager.id) {
    return { success: false, error: 'An employee cannot report to themselves' };
  }

  // Prevent circular reporting
  let current = newManager;
  const visited = new Set([employee.id]);
  while (current.manager_id) {
    if (visited.has(current.manager_id)) {
      return { success: false, error: 'This change would create a circular reporting relationship' };
    }
    visited.add(current.id);
    const next = await Employee.filter({ id: current.manager_id });
    if (next.length === 0) break;
    current = next[0];
  }

  const oldManagerId = employee.manager_id;
  await Employee.update(employee.id, { manager_id: newManager.id });

  return {
    success: true,
    message: `${employee.first_name} ${employee.last_name} now reports to ${newManager.first_name} ${newManager.last_name}`,
    data: {
      employee_id: employee.id,
      old_manager_id: oldManagerId,
      new_manager_id: newManager.id,
    },
  };
}