/**
 * Manager Validation Helper
 * 
 * Resolves valid manager options for an employee based on:
 * - Same entity
 * - Active status
 * - Same department OR is department head/executive
 * - No reporting cycles
 */

/**
 * Get all subordinates (direct and indirect) of an employee
 * Used to prevent manager cycles
 */
export function getAllSubordinates(employeeId, allEmployees) {
  const subordinates = new Set();
  
  const findSubordinates = (managerId) => {
    allEmployees.forEach(emp => {
      if (emp.manager_id === managerId && !subordinates.has(emp.id)) {
        subordinates.add(emp.id);
        findSubordinates(emp.id);
      }
    });
  };
  
  findSubordinates(employeeId);
  return subordinates;
}

/**
 * Check if assigning a manager would create a cycle
 */
export function wouldCreateCycle(employeeId, proposedManagerId, allEmployees) {
  if (!proposedManagerId) return false;
  if (employeeId === proposedManagerId) return true;
  
  const subordinates = getAllSubordinates(employeeId, allEmployees);
  return subordinates.has(proposedManagerId);
}

/**
 * Get valid manager options for an employee
 * 
 * @param {Object} employee - The employee being edited (or form values)
 * @param {Array} allEmployees - All employees in the system
 * @param {Object} options - Additional options
 * @returns {Object} - { validManagers, currentManagerWarning }
 */
export function getValidManagerOptions(employee, allEmployees, options = {}) {
  const {
    entityId = employee.entity_id,
    departmentId = employee.department_id,
  } = options;

  const employeeId = employee.id;
  
  // Get subordinates to prevent cycles
  const subordinates = employeeId ? getAllSubordinates(employeeId, allEmployees) : new Set();
  
  // Base filter: same entity, active/onboarding, not self, no cycles
  const baseFiltered = allEmployees.filter(candidate => {
    // Cannot be self
    if (candidate.id === employeeId) return false;
    
    // Must be in same entity
    if (entityId && candidate.entity_id !== entityId) return false;
    
    // Must be active or onboarding
    if (!['active', 'onboarding'].includes(candidate.status)) return false;
    
    // Cannot be a subordinate (would create cycle)
    if (subordinates.has(candidate.id)) return false;
    
    return true;
  });

  // Categorize candidates
  const executives = [];
  const departmentHeads = [];
  const sameDepartment = [];
  const otherValid = [];
  
  baseFiltered.forEach(candidate => {
    if (candidate.is_executive) {
      executives.push(candidate);
    } else if (candidate.is_department_head) {
      departmentHeads.push(candidate);
    } else if (departmentId && candidate.department_id === departmentId) {
      sameDepartment.push(candidate);
    } else {
      // Other employees in same entity - include for flexibility
      // but they should generally be department heads or executives
      otherValid.push(candidate);
    }
  });

  // Build final list with grouping info
  const validManagers = [
    ...executives.map(e => ({ ...e, group: 'executives', groupLabel: 'Executives' })),
    ...departmentHeads.map(e => ({ ...e, group: 'department_heads', groupLabel: 'Department Heads' })),
    ...sameDepartment.map(e => ({ ...e, group: 'same_department', groupLabel: 'Same Department' })),
    ...otherValid.map(e => ({ ...e, group: 'other', groupLabel: 'Other' })),
  ];

  // Check if current manager is outside valid set
  let currentManagerWarning = null;
  if (employee.manager_id) {
    const currentManager = allEmployees.find(e => e.id === employee.manager_id);
    if (currentManager) {
      const isInValidSet = validManagers.some(m => m.id === currentManager.id);
      
      if (!isInValidSet) {
        // Check why they're invalid
        const reasons = [];
        if (entityId && currentManager.entity_id !== entityId) {
          reasons.push('different entity');
        }
        if (!['active', 'onboarding'].includes(currentManager.status)) {
          reasons.push('inactive');
        }
        if (subordinates.has(currentManager.id)) {
          reasons.push('would create cycle');
        }
        
        currentManagerWarning = {
          manager: currentManager,
          reasons,
          message: `Current manager is ${reasons.join(', ')}. Consider updating.`,
        };
        
        // Add current manager to list so form can still be saved
        validManagers.unshift({
          ...currentManager,
          group: 'current_invalid',
          groupLabel: 'Current (Outside Department)',
          isInvalid: true,
        });
      }
    }
  }

  return {
    validManagers,
    currentManagerWarning,
    groups: [
      { key: 'current_invalid', label: 'Current (Needs Update)' },
      { key: 'executives', label: 'Executives' },
      { key: 'department_heads', label: 'Department Heads' },
      { key: 'same_department', label: 'Same Department' },
      { key: 'other', label: 'Other' },
    ].filter(g => validManagers.some(m => m.group === g.key)),
  };
}

/**
 * Validate manager assignment before save
 * Returns { valid: boolean, error?: string }
 */
export function validateManagerAssignment(employeeId, newManagerId, entityId, allEmployees) {
  // No manager is always valid
  if (!newManagerId) {
    return { valid: true };
  }

  const manager = allEmployees.find(e => e.id === newManagerId);
  
  if (!manager) {
    return { valid: false, error: 'Selected manager does not exist.' };
  }

  // Check entity match
  if (entityId && manager.entity_id !== entityId) {
    return { 
      valid: false, 
      error: 'Manager must be in the same company entity.' 
    };
  }

  // Check status
  if (!['active', 'onboarding'].includes(manager.status)) {
    return { 
      valid: false, 
      error: 'Cannot assign an inactive employee as manager.' 
    };
  }

  // Check for cycles
  if (wouldCreateCycle(employeeId, newManagerId, allEmployees)) {
    return { 
      valid: false, 
      error: 'This assignment would create a reporting loop.' 
    };
  }

  return { valid: true };
}