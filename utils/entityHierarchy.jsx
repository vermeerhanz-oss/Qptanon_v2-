import { base44 } from '@/api/base44Client';

const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;

/**
 * Entity Hierarchy Utility
 * 
 * Provides org-chart aware entity assignment logic.
 * If an employee doesn't have an explicit entity_id, they inherit from their manager chain.
 */

/**
 * Get the effective entity ID for an employee.
 * 
 * Priority:
 * 1. Employee's own entity_id (explicit override)
 * 2. Walk up the manager chain to find the first ancestor with entity_id
 * 3. Fall back to the company's default entity (if one exists)
 * 4. Return null if no entity can be determined
 * 
 * @param {string} employeeId - The employee ID to resolve
 * @param {Object} options - Optional configuration
 * @param {Array} options.employees - Pre-loaded employees array (avoids extra fetches)
 * @param {Array} options.entities - Pre-loaded entities array (avoids extra fetches)
 * @returns {Promise<{entityId: string|null, source: string, inheritedFrom: string|null}>}
 */
export async function getEffectiveEntityIdForEmployee(employeeId, options = {}) {
  let employees = options.employees;
  let entities = options.entities;

  // Load data if not provided
  if (!employees) {
    employees = await Employee.list();
  }
  if (!entities) {
    entities = await CompanyEntity.list();
  }

  const employee = employees.find(e => e.id === employeeId);
  if (!employee) {
    return { entityId: null, source: 'not_found', inheritedFrom: null };
  }

  // 1. Check if employee has explicit entity_id
  if (employee.entity_id) {
    return { 
      entityId: employee.entity_id, 
      source: 'explicit', 
      inheritedFrom: null 
    };
  }

  // 2. Walk up the manager chain
  const visited = new Set([employeeId]); // Prevent infinite loops
  let currentManagerId = employee.manager_id;

  while (currentManagerId) {
    if (visited.has(currentManagerId)) {
      // Circular reference detected, break out
      break;
    }
    visited.add(currentManagerId);

    const manager = employees.find(e => e.id === currentManagerId);
    if (!manager) {
      break;
    }

    if (manager.entity_id) {
      return { 
        entityId: manager.entity_id, 
        source: 'inherited', 
        inheritedFrom: manager.id 
      };
    }

    currentManagerId = manager.manager_id;
  }

  // 3. Fall back to default entity
  const defaultEntity = entities.find(e => e.is_default === true);
  if (defaultEntity) {
    return { 
      entityId: defaultEntity.id, 
      source: 'default', 
      inheritedFrom: null 
    };
  }

  // 4. No entity found
  return { entityId: null, source: 'none', inheritedFrom: null };
}

/**
 * Get effective entity IDs for multiple employees efficiently.
 * 
 * @param {Array<string>} employeeIds - Array of employee IDs
 * @param {Object} options - Optional configuration
 * @returns {Promise<Map<string, {entityId: string|null, source: string, inheritedFrom: string|null}>>}
 */
export async function getEffectiveEntityIdsForEmployees(employeeIds, options = {}) {
  let employees = options.employees;
  let entities = options.entities;

  // Load data once
  if (!employees) {
    employees = await Employee.list();
  }
  if (!entities) {
    entities = await CompanyEntity.list();
  }

  const results = new Map();
  
  for (const employeeId of employeeIds) {
    const result = await getEffectiveEntityIdForEmployee(employeeId, { employees, entities });
    results.set(employeeId, result);
  }

  return results;
}

/**
 * Synchronous version for when employees/entities are already loaded.
 * 
 * @param {string} employeeId - The employee ID to resolve
 * @param {Array} employees - All employees
 * @param {Array} entities - All entities
 * @returns {{entityId: string|null, source: string, inheritedFrom: string|null}}
 */
export function getEffectiveEntityIdSync(employeeId, employees, entities) {
  const employee = employees.find(e => e.id === employeeId);
  if (!employee) {
    return { entityId: null, source: 'not_found', inheritedFrom: null };
  }

  // 1. Check if employee has explicit entity_id
  if (employee.entity_id) {
    return { 
      entityId: employee.entity_id, 
      source: 'explicit', 
      inheritedFrom: null 
    };
  }

  // 2. Walk up the manager chain
  const visited = new Set([employeeId]);
  let currentManagerId = employee.manager_id;

  while (currentManagerId) {
    if (visited.has(currentManagerId)) {
      break;
    }
    visited.add(currentManagerId);

    const manager = employees.find(e => e.id === currentManagerId);
    if (!manager) {
      break;
    }

    if (manager.entity_id) {
      return { 
        entityId: manager.entity_id, 
        source: 'inherited', 
        inheritedFrom: manager.id 
      };
    }

    currentManagerId = manager.manager_id;
  }

  // 3. Fall back to default entity
  const defaultEntity = entities.find(e => e.is_default === true);
  if (defaultEntity) {
    return { 
      entityId: defaultEntity.id, 
      source: 'default', 
      inheritedFrom: null 
    };
  }

  return { entityId: null, source: 'none', inheritedFrom: null };
}

/**
 * Get all employees who would be affected if a manager's entity changes.
 * Returns employees who don't have an explicit entity_id and report to this manager (directly or indirectly).
 * 
 * @param {string} managerId - The manager whose entity might change
 * @param {Array} employees - All employees
 * @returns {Array<Object>} - Employees who inherit entity from this manager
 */
export function getEmployeesInheritingEntityFrom(managerId, employees) {
  const affected = [];
  const visited = new Set();

  function collectReports(mgrId) {
    const directReports = employees.filter(e => 
      e.manager_id === mgrId && 
      !e.entity_id && // Only those without explicit entity
      !visited.has(e.id)
    );

    for (const report of directReports) {
      visited.add(report.id);
      affected.push(report);
      // Recursively collect their reports
      collectReports(report.id);
    }
  }

  collectReports(managerId);
  return affected;
}

/**
 * Build a map of employee_id -> effective entity for all employees.
 * Useful for bulk operations and reporting.
 * 
 * @param {Array} employees - All employees
 * @param {Array} entities - All entities
 * @returns {Map<string, {entityId: string|null, source: string, inheritedFrom: string|null}>}
 */
export function buildEffectiveEntityMap(employees, entities) {
  const map = new Map();
  
  for (const employee of employees) {
    const result = getEffectiveEntityIdSync(employee.id, employees, entities);
    map.set(employee.id, result);
  }

  return map;
}