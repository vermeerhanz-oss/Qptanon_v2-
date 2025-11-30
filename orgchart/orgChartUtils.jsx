import { base44 } from '@/api/base44Client';

const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;
const Department = base44.entities.Department;
const Location = base44.entities.Location;

/**
 * Build org chart data structure from Employee entities
 * Groups by CompanyEntity, then builds hierarchy from manager_id
 */
export async function buildOrgChartData() {
  const [employees, entities, departments, locations] = await Promise.all([
    Employee.list(),
    CompanyEntity.list(),
    Department.list(),
    Location.list(),
  ]);

  // Create lookup maps
  const employeeMap = new Map(employees.map(e => [e.id, e]));
  const departmentMap = new Map(departments.map(d => [d.id, d]));
  const locationMap = new Map(locations.map(l => [l.id, l]));
  const entityMap = new Map(entities.map(e => [e.id, e]));

  // Group employees by entity
  const employeesByEntity = new Map();
  const noEntityEmployees = [];

  employees.forEach(emp => {
    if (emp.entity_id) {
      if (!employeesByEntity.has(emp.entity_id)) {
        employeesByEntity.set(emp.entity_id, []);
      }
      employeesByEntity.get(emp.entity_id).push(emp);
    } else {
      noEntityEmployees.push(emp);
    }
  });

  // Build chart structure
  const chartData = {
    entities: [],
    unassigned: null,
  };

  // Process each entity
  for (const [entityId, entityEmployees] of employeesByEntity) {
    const entity = entityMap.get(entityId);
    const entityNode = {
      id: entityId,
      type: 'entity',
      name: entity?.name || 'Unknown Entity',
      abbreviation: entity?.abbreviation || '',
      country: entity?.country || '',
      status: entity?.status || 'active',
      employees: entityEmployees.length,
      roots: [], // Top-level employees (no manager or manager outside entity)
    };

    // Find root employees (no manager or manager not in this entity)
    const entityEmployeeIds = new Set(entityEmployees.map(e => e.id));
    const rootEmployees = entityEmployees.filter(emp => 
      !emp.manager_id || !entityEmployeeIds.has(emp.manager_id)
    );

    // Build tree for each root
    entityNode.roots = rootEmployees.map(root => 
      buildEmployeeNode(root, entityEmployees, employeeMap, departmentMap, locationMap)
    );

    chartData.entities.push(entityNode);
  }

  // Handle employees without entity
  if (noEntityEmployees.length > 0) {
    const rootEmployees = noEntityEmployees.filter(emp => !emp.manager_id);
    chartData.unassigned = {
      id: 'unassigned',
      type: 'entity',
      name: 'Unassigned',
      abbreviation: '',
      country: '',
      status: 'active',
      employees: noEntityEmployees.length,
      roots: rootEmployees.map(root => 
        buildEmployeeNode(root, noEntityEmployees, employeeMap, departmentMap, locationMap)
      ),
    };
  }

  return chartData;
}

/**
 * Recursively build employee node with children
 */
function buildEmployeeNode(employee, allEmployees, employeeMap, departmentMap, locationMap) {
  const directReports = allEmployees.filter(e => e.manager_id === employee.id);
  
  return {
    id: employee.id,
    type: 'employee',
    firstName: employee.first_name,
    lastName: employee.last_name,
    preferredName: employee.preferred_name,
    fullName: `${employee.preferred_name || employee.first_name} ${employee.last_name}`,
    jobTitle: employee.job_title,
    department: departmentMap.get(employee.department_id)?.name || null,
    departmentId: employee.department_id,
    location: locationMap.get(employee.location_id)?.name || null,
    locationId: employee.location_id,
    email: employee.email,
    phone: employee.phone,
    status: employee.status,
    employmentType: employee.employment_type,
    startDate: employee.start_date,
    managerId: employee.manager_id,
    managerName: employee.manager_id 
      ? `${employeeMap.get(employee.manager_id)?.first_name || ''} ${employeeMap.get(employee.manager_id)?.last_name || ''}`.trim()
      : null,
    entityId: employee.entity_id,
    directReports: directReports.map(dr => 
      buildEmployeeNode(dr, allEmployees, employeeMap, departmentMap, locationMap)
    ),
    directReportsCount: countAllReports(employee.id, allEmployees),
  };
}

/**
 * Count all reports (direct + indirect) for an employee
 */
function countAllReports(employeeId, allEmployees) {
  let count = 0;
  const directReports = allEmployees.filter(e => e.manager_id === employeeId);
  count += directReports.length;
  directReports.forEach(dr => {
    count += countAllReports(dr.id, allEmployees);
  });
  return count;
}

/**
 * Get reporting chain (path to top)
 */
export async function getReportingChain(employeeId) {
  const employees = await Employee.list();
  const employeeMap = new Map(employees.map(e => [e.id, e]));
  
  const chain = [];
  let currentId = employeeId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const emp = employeeMap.get(currentId);
    if (!emp) break;
    chain.push(emp);
    currentId = emp.manager_id;
  }

  return chain;
}

/**
 * Get all direct and indirect reports for an employee
 */
export async function getAllReports(employeeId) {
  const employees = await Employee.list();
  const reports = [];
  
  function collectReports(managerId) {
    const directReports = employees.filter(e => e.manager_id === managerId);
    directReports.forEach(dr => {
      reports.push(dr);
      collectReports(dr.id);
    });
  }

  collectReports(employeeId);
  return reports;
}

/**
 * Check if user can view employee based on org hierarchy
 */
export function canViewInOrgChart(viewer, target, viewerEmployee) {
  // Admin can see everyone
  if (viewer?.role === 'admin') return true;
  
  // Same entity check
  if (viewerEmployee?.entity_id && target.entity_id) {
    if (viewerEmployee.entity_id !== target.entity_id) {
      // Cross-entity - only if viewer manages target
      return isInReportingChain(viewerEmployee.id, target.id);
    }
  }
  
  // Same entity - managers can see their reports
  if (viewer?.role === 'manager') {
    return true; // Managers can view within entity
  }
  
  // Regular employees can see org chart
  return true;
}

/**
 * Check if targetId is in the reporting chain under managerId
 */
function isInReportingChain(managerId, targetId, employees) {
  const visited = new Set();
  
  function check(currentId) {
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    
    if (currentId === targetId) return true;
    
    const directReports = employees?.filter(e => e.manager_id === currentId) || [];
    return directReports.some(dr => check(dr.id));
  }
  
  return check(managerId);
}