/**
 * Employee Tree Utilities
 * Converts flat employee list into hierarchical tree based on manager_id
 */

/**
 * Build a tree structure from flat employee list
 * @param {Array} employees - All employees
 * @param {string|null} entityId - Optional entity filter
 * @returns {Array} - Tree nodes with children
 */
export function buildEmployeeTree(employees, entityId = null) {
  // Filter by entity if specified
  const filtered = entityId 
    ? employees.filter(e => e.entity_id === entityId)
    : employees;
  
  // Create a map for quick lookup
  const employeeMap = new Map();
  filtered.forEach(emp => {
    employeeMap.set(emp.id, { ...emp, children: [] });
  });
  
  const roots = [];
  const visited = new Set(); // Cycle detection
  
  filtered.forEach(emp => {
    const node = employeeMap.get(emp.id);
    
    // Check if this is a root node:
    // - No manager_id
    // - Manager is in different entity
    // - Manager doesn't exist in our filtered set
    const isRoot = !emp.manager_id || 
      !employeeMap.has(emp.manager_id);
    
    if (isRoot) {
      roots.push(node);
    } else {
      const parent = employeeMap.get(emp.manager_id);
      if (parent && !visited.has(emp.id)) {
        parent.children.push(node);
      }
    }
    visited.add(emp.id);
  });
  
  // Sort children by name at each level
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => {
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };
  
  sortChildren(roots);
  return roots;
}

/**
 * Flatten tree back to array with depth info
 * @param {Array} tree - Tree nodes
 * @param {Set} expandedIds - Set of expanded node IDs
 * @param {number} depth - Current depth
 * @returns {Array} - Flat array with depth property
 */
export function flattenTree(tree, expandedIds, depth = 0) {
  const result = [];
  
  tree.forEach(node => {
    result.push({ ...node, depth, hasChildren: node.children.length > 0 });
    
    if (node.children.length > 0 && expandedIds.has(node.id)) {
      result.push(...flattenTree(node.children, expandedIds, depth + 1));
    }
  });
  
  return result;
}

/**
 * Get all ancestor IDs for an employee
 */
export function getAncestorIds(employeeId, employees) {
  const ancestors = [];
  const empMap = new Map(employees.map(e => [e.id, e]));
  
  let current = empMap.get(employeeId);
  while (current?.manager_id) {
    ancestors.push(current.manager_id);
    current = empMap.get(current.manager_id);
    // Cycle detection
    if (ancestors.includes(current?.id)) break;
  }
  
  return ancestors;
}

/**
 * Get all descendant IDs for an employee
 */
export function getDescendantIds(employeeId, employees) {
  const descendants = [];
  const childMap = new Map();
  
  employees.forEach(emp => {
    if (emp.manager_id) {
      if (!childMap.has(emp.manager_id)) {
        childMap.set(emp.manager_id, []);
      }
      childMap.get(emp.manager_id).push(emp.id);
    }
  });
  
  const collect = (id) => {
    const children = childMap.get(id) || [];
    children.forEach(childId => {
      if (!descendants.includes(childId)) {
        descendants.push(childId);
        collect(childId);
      }
    });
  };
  
  collect(employeeId);
  return descendants;
}

/**
 * Get breadcrumb path from root to employee
 */
export function getBreadcrumbPath(employeeId, employees) {
  const path = [];
  const empMap = new Map(employees.map(e => [e.id, e]));
  
  let current = empMap.get(employeeId);
  while (current) {
    path.unshift(current);
    if (!current.manager_id) break;
    current = empMap.get(current.manager_id);
    // Cycle detection
    if (path.some(p => p.id === current?.id)) break;
  }
  
  return path;
}

/**
 * Filter tree while preserving hierarchy context
 * Shows matching employees + their ancestors for context
 */
export function filterTreeWithContext(employees, matchFn) {
  // Find all matching employee IDs
  const matchingIds = new Set(
    employees.filter(matchFn).map(e => e.id)
  );
  
  // Add all ancestors of matching employees
  const visibleIds = new Set(matchingIds);
  matchingIds.forEach(id => {
    const ancestors = getAncestorIds(id, employees);
    ancestors.forEach(ancestorId => visibleIds.add(ancestorId));
  });
  
  return {
    visibleIds,
    matchingIds,
    isMatch: (id) => matchingIds.has(id),
    isVisible: (id) => visibleIds.has(id),
  };
}

/**
 * Get subtree rooted at a specific employee
 */
export function getSubtree(employeeId, employees) {
  const empMap = new Map(employees.map(e => [e.id, e]));
  const root = empMap.get(employeeId);
  if (!root) return [];
  
  const descendants = getDescendantIds(employeeId, employees);
  const subtreeEmployees = [root, ...descendants.map(id => empMap.get(id)).filter(Boolean)];
  
  // Rebuild tree with this employee as root
  return buildEmployeeTree(subtreeEmployees.map(e => ({
    ...e,
    manager_id: e.id === employeeId ? null : e.manager_id
  })));
}