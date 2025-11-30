import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Users } from 'lucide-react';
import OrgChartTree from '@/components/orgchart/OrgChartTree';
import OrgChartToolbar from '@/components/orgchart/OrgChartToolbar';
import OrgChartFilters from '@/components/orgchart/OrgChartFilters';
import EmployeeDrawer from '@/components/orgchart/EmployeeDrawer';

const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;
const Department = base44.entities.Department;
const Location = base44.entities.Location;

export default function OrgChart() {
  const [employees, setEmployees] = useState([]);
  const [entities, setEntities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Tree state
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  
  // Unified view transform state
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    entity: 'all',
    department: 'all',
    location: 'all',
    status: ['active', 'onboarding', 'offboarding', 'terminated']
  });
  const [visualizeBy, setVisualizeBy] = useState('department');
  
  // Drawer
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const chartRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [emps, ents, depts, locs] = await Promise.all([
        Employee.list(),
        CompanyEntity.list(),
        Department.list(),
        Location.list(),
      ]);
      setEmployees(emps);
      setEntities(ents);
      setDepartments(depts);
      setLocations(locs);

      // Auto-expand top-level nodes
      const topLevel = new Set();
      emps.forEach(emp => {
        if (!emp.manager_id || !emps.find(e => e.id === emp.manager_id)) {
          topLevel.add(emp.id);
        }
      });
      setExpandedNodes(topLevel);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build tree structure
  const buildTree = useCallback(() => {
    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    const locMap = new Map(locations.map(l => [l.id, l.name]));
    const entityMap = new Map(entities.map(e => [e.id, e]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Filter employees
    const filteredEmployees = employees.filter(emp => {
      if (filters.entity !== 'all' && emp.entity_id !== filters.entity) return false;
      if (filters.department !== 'all' && emp.department_id !== filters.department) return false;
      if (filters.location !== 'all' && emp.location_id !== filters.location) return false;
      if (!filters.status.includes(emp.status)) return false;
      return true;
    });

    const filteredIds = new Set(filteredEmployees.map(e => e.id));

    // Build node from employee
    const buildNode = (emp) => {
      const directReports = employees.filter(e => 
        e.manager_id === emp.id && filteredIds.has(e.id)
      );
      
      return {
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        email: emp.email,
        phone: emp.phone,
        jobTitle: emp.job_title,
        department: deptMap.get(emp.department_id) || null,
        departmentId: emp.department_id,
        location: locMap.get(emp.location_id) || null,
        locationId: emp.location_id,
        entityId: emp.entity_id,
        entityName: entityMap.get(emp.entity_id)?.abbreviation || entityMap.get(emp.entity_id)?.name || null,
        status: emp.status,
        employmentType: emp.employment_type,
        startDate: emp.start_date,
        managerId: emp.manager_id,
        directReports: directReports.map(dr => buildNode(dr)),
        directReportsCount: employees.filter(e => e.manager_id === emp.id).length,
      };
    };

    // Group by entity
    const groupedByEntity = new Map();
    
    filteredEmployees.forEach(emp => {
      const entityId = emp.entity_id || 'unassigned';
      if (!groupedByEntity.has(entityId)) {
        groupedByEntity.set(entityId, []);
      }
      groupedByEntity.get(entityId).push(emp);
    });

    // Build trees for each entity
    const result = [];
    
    groupedByEntity.forEach((entityEmployees, entityId) => {
      const entity = entityId !== 'unassigned' ? entityMap.get(entityId) : null;
      
      // Find root employees (no manager or manager not in this entity)
      const entityEmpIds = new Set(entityEmployees.map(e => e.id));
      const roots = entityEmployees.filter(emp => 
        !emp.manager_id || !entityEmpIds.has(emp.manager_id)
      );

      result.push({
        entityId,
        entityName: entity?.name || 'Unassigned',
        entityAbbreviation: entity?.abbreviation || '',
        entityCountry: entity?.country || '',
        status: entity?.status || 'active',
        employeeCount: entityEmployees.length,
        roots: roots.map(r => buildNode(r)),
      });
    });

    return result;
  }, [employees, entities, departments, locations, filters]);

  const treeData = buildTree();

  // Search results
  const searchResults = searchQuery.length > 1 
    ? employees.filter(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        const email = (emp.email || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || email.includes(query);
      }).map(emp => ({
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        jobTitle: emp.job_title,
        managerId: emp.manager_id,
      }))
    : [];

  // Expand path to node
  const expandPathToNode = (nodeId) => {
    const emp = employees.find(e => e.id === nodeId);
    if (!emp) return;

    const path = new Set([nodeId]);
    let current = emp;
    while (current.manager_id) {
      path.add(current.manager_id);
      current = employees.find(e => e.id === current.manager_id);
      if (!current) break;
    }

    setExpandedNodes(prev => new Set([...prev, ...path]));
  };

  // Handle search result selection
  const handleSelectSearchResult = (result) => {
    setSearchQuery('');
    setHighlightedNodeId(result.id);
    expandPathToNode(result.id);
    
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedNodeId(null), 3000);
  };

  // Toggle node expansion
  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Expand all nodes
  const expandAll = () => {
    setExpandedNodes(new Set(employees.map(e => e.id)));
  };

  // Collapse to top level
  const collapseAll = () => {
    const topLevel = new Set();
    employees.forEach(emp => {
      if (!emp.manager_id || !employees.find(e => e.id === emp.manager_id)) {
        topLevel.add(emp.id);
      }
    });
    setExpandedNodes(topLevel);
  };

  // Zoom controls
  const zoomIn = () => setViewTransform(v => ({ ...v, scale: Math.min(1.5, v.scale + 0.1) }));
  const zoomOut = () => setViewTransform(v => ({ ...v, scale: Math.max(0.3, v.scale - 0.1) }));
  const fitToScreen = () => setViewTransform({ x: 0, y: 0, scale: 0.8 });

  // Pan handling (click-and-drag)
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setViewTransform(v => ({
      ...v,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Trackpad wheel panning & pinch zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      
      // Pinch zoom (ctrl/meta + wheel)
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setViewTransform(v => ({
          ...v,
          scale: Math.min(1.5, Math.max(0.3, v.scale + delta)),
        }));
        return;
      }

      // Two-finger pan
      setViewTransform(v => ({
        ...v,
        x: v.x - e.deltaX,
        y: v.y - e.deltaY,
      }));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Export as image
  const handleExport = async () => {
    if (!chartRef.current) return;
    
    try {
      // Simple approach: open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Org Chart Export</title>
              <style>
                body { font-family: system-ui, sans-serif; padding: 40px; }
                .node { margin: 20px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; display: inline-block; }
              </style>
            </head>
            <body>
              <h1>Organization Chart</h1>
              <p>Exported on ${new Date().toLocaleDateString()}</p>
              ${chartRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Handle node click
  const handleNodeClick = (node) => {
    const emp = employees.find(e => e.id === node.id);
    const mgr = emp?.manager_id ? employees.find(e => e.id === emp.manager_id) : null;
    const reports = employees.filter(e => e.manager_id === node.id);
    
    setSelectedEmployee({
      ...node,
      manager: mgr ? {
        id: mgr.id,
        firstName: mgr.first_name,
        lastName: mgr.last_name,
        jobTitle: mgr.job_title,
      } : null,
      directReportsList: reports.map(r => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        jobTitle: r.job_title,
      }))
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 -m-4 sm:-m-6 lg:-m-8">
      {/* Filters Bar */}
      <OrgChartFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
        filters={filters}
        onFiltersChange={setFilters}
        visualizeBy={visualizeBy}
        onVisualizeByChange={setVisualizeBy}
        entities={entities}
        departments={departments}
        locations={locations}
      />

      {/* Chart Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          ref={chartRef}
          className="min-w-max p-8 transition-transform"
          style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
            transformOrigin: 'top center',
          }}
        >
          {treeData.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No employees found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-12">
              {treeData.map(entityGroup => (
                <div key={entityGroup.entityId} className="flex flex-col items-center">
                  {/* Entity Header */}
                  <div className="mb-8 flex items-center gap-3 bg-white px-6 py-3 rounded-xl shadow-sm border-2 border-gray-200">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">{entityGroup.entityName}</h2>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {entityGroup.entityAbbreviation && (
                          <Badge variant="outline">{entityGroup.entityAbbreviation}</Badge>
                        )}
                        <span>{entityGroup.employeeCount} employees</span>
                      </div>
                    </div>
                  </div>

                  {/* Entity Tree */}
                  <OrgChartTree
                    nodes={entityGroup.roots}
                    expandedNodes={expandedNodes}
                    onToggleExpand={toggleExpand}
                    highlightedNodeId={highlightedNodeId}
                    visualizeBy={visualizeBy}
                    onNodeClick={handleNodeClick}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Toolbar */}
      <OrgChartToolbar
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToScreen={fitToScreen}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onExport={handleExport}
        zoom={Math.round(viewTransform.scale * 100)}
      />

      {/* Employee Drawer */}
      <EmployeeDrawer
        employee={selectedEmployee}
        manager={selectedEmployee?.manager}
        directReports={selectedEmployee?.directReportsList}
        onClose={() => setSelectedEmployee(null)}
      />
    </div>
  );
}