import { base44 } from '@/api/base44Client';

const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;

/**
 * Multi-Entity Permission System
 * Manages access control across different company entities
 */

/**
 * Check if user has global admin access
 */
export function isGlobalAdmin(user) {
  return user?.role === 'admin';
}

/**
 * Check if user is entity admin for a specific entity
 */
export async function isEntityAdmin(user, entityId) {
  if (isGlobalAdmin(user)) return true;
  
  // Check if user is HR contact for this entity
  const entities = await CompanyEntity.filter({ id: entityId });
  if (entities.length === 0) return false;
  
  const entity = entities[0];
  const employees = await Employee.filter({ user_id: user.id });
  
  if (employees.length === 0) return false;
  
  return entity.hr_contact_id === employees[0].id;
}

/**
 * Check if user can view an employee
 * Rules:
 * - Global admin: can view all
 * - Entity admin/HR: can view all in their entity
 * - Manager: can view direct/indirect reports + same entity
 * - Employee: can view self + org chart (limited info)
 */
export async function canViewEmployee(user, currentEmployee, targetEmployee) {
  // Global admin
  if (isGlobalAdmin(user)) return true;
  
  // Self
  if (currentEmployee?.id === targetEmployee.id) return true;
  
  // Same entity check
  if (currentEmployee?.entity_id === targetEmployee.entity_id) {
    // Entity HR contact
    if (currentEmployee.entity_id) {
      const entities = await CompanyEntity.filter({ id: currentEmployee.entity_id });
      if (entities.length > 0 && entities[0].hr_contact_id === currentEmployee.id) {
        return true;
      }
    }
    
    // Manager can view within entity
    if (user?.role === 'manager') return true;
    
    // Regular employee can view basic info within entity
    return true;
  }
  
  // Cross-entity: only if direct/indirect manager
  return await isManagerOf(currentEmployee?.id, targetEmployee.id);
}

/**
 * Check if user can edit an employee
 */
export async function canEditEmployee(user, currentEmployee, targetEmployee) {
  // Global admin
  if (isGlobalAdmin(user)) return true;
  
  // Self - limited fields only
  if (currentEmployee?.id === targetEmployee.id) return 'self';
  
  // Entity HR contact
  if (currentEmployee?.entity_id === targetEmployee.entity_id && currentEmployee.entity_id) {
    const entities = await CompanyEntity.filter({ id: currentEmployee.entity_id });
    if (entities.length > 0 && entities[0].hr_contact_id === currentEmployee.id) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get employees visible to user
 */
export async function getVisibleEmployees(user, currentEmployee) {
  const allEmployees = await Employee.list();
  
  // Global admin sees all
  if (isGlobalAdmin(user)) return allEmployees;
  
  if (!currentEmployee) return [];
  
  // Filter by entity + management chain
  const visible = [];
  
  for (const emp of allEmployees) {
    // Same entity
    if (emp.entity_id === currentEmployee.entity_id) {
      visible.push(emp);
      continue;
    }
    
    // Cross-entity: only if we manage them
    if (await isManagerOf(currentEmployee.id, emp.id)) {
      visible.push(emp);
    }
  }
  
  return visible;
}

/**
 * Check if managerId manages targetId (directly or indirectly)
 */
async function isManagerOf(managerId, targetId) {
  if (!managerId || !targetId) return false;
  
  const employees = await Employee.list();
  const employeeMap = new Map(employees.map(e => [e.id, e]));
  
  let current = employeeMap.get(targetId);
  const visited = new Set();
  
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.manager_id === managerId) return true;
    current = employeeMap.get(current.manager_id);
  }
  
  return false;
}

/**
 * Get entities user has access to
 */
export async function getAccessibleEntities(user, currentEmployee) {
  const allEntities = await CompanyEntity.list();
  
  // Global admin sees all
  if (isGlobalAdmin(user)) return allEntities;
  
  if (!currentEmployee) return [];
  
  // User can access their own entity
  const accessibleIds = new Set();
  if (currentEmployee.entity_id) {
    accessibleIds.add(currentEmployee.entity_id);
  }
  
  // If user manages someone in another entity, they can see that entity
  const allEmployees = await Employee.list();
  for (const emp of allEmployees) {
    if (emp.entity_id && await isManagerOf(currentEmployee.id, emp.id)) {
      accessibleIds.add(emp.entity_id);
    }
  }
  
  return allEntities.filter(e => accessibleIds.has(e.id));
}

/**
 * Fields employees can edit on their own profile
 */
export const SELF_EDITABLE_FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'preferred_name',
  'personal_email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postcode',
  'country',
  'date_of_birth',
];

/**
 * Check if a field is editable by the user
 */
export function canEditField(permission, fieldName) {
  if (permission === true) return true; // Full access
  if (permission === 'self') return SELF_EDITABLE_FIELDS.includes(fieldName);
  return false;
}