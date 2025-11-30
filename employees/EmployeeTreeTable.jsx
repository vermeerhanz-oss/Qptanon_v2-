import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronRight, ChevronDown, Users, MoreHorizontal, Focus, RotateCcw, Calendar } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/Badge';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  buildEmployeeTree,
  flattenTree,
  getAncestorIds,
  filterTreeWithContext,
  getBreadcrumbPath,
  getSubtree,
} from './employeeTreeUtils';

/**
 * Get IDs that should be expanded by default (depth 0 and 1)
 */
function getDefaultExpandedIds(tree) {
  const ids = new Set();
  
  if (!tree || !Array.isArray(tree)) return ids;
  
  // Expand roots (depth 0)
  tree.forEach(node => {
    if (!node || !Array.isArray(node.children)) return;
    if (node.children.length > 0) {
      ids.add(node.id);
      // Expand direct reports of roots (depth 1)
      node.children.forEach(child => {
        if (child && Array.isArray(child.children) && child.children.length > 0) {
          ids.add(child.id);
        }
      });
    }
  });
  
  return ids;
}

export function EmployeeTreeTable({
  employees,
  departments,
  locations,
  isLoading,
  onRowClick,
  search,
  filters,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set()); // Empty set initially
  const [focusedEmployeeId, setFocusedEmployeeId] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const getDeptName = (id) => departments.find(d => d.id === id)?.name || '—';
  const getLocName = (id) => locations.find(l => l.id === id)?.name || '—';

  // Apply filters to determine which employees match
  const filterResult = useMemo(() => {
    const matchFn = (emp) => {
      const searchMatch = !search || 
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        emp.email?.toLowerCase().includes(search.toLowerCase());
      const deptMatch = !filters.departmentId || filters.departmentId === 'all' || emp.department_id === filters.departmentId;
      const locMatch = !filters.locationId || filters.locationId === 'all' || emp.location_id === filters.locationId;
      const statusMatch = !filters.status || filters.status === 'all' || emp.status === filters.status;
      return searchMatch && deptMatch && locMatch && statusMatch;
    };
    return filterTreeWithContext(employees, matchFn);
  }, [employees, search, filters]);

  // Auto-expand to show search results
  useEffect(() => {
    if (search && search.length > 0) {
      const newExpanded = new Set(expandedIds);
      filterResult.matchingIds.forEach(id => {
        const ancestors = getAncestorIds(id, employees);
        ancestors.forEach(ancestorId => newExpanded.add(ancestorId));
      });
      setExpandedIds(newExpanded);
    }
  }, [search, filterResult.matchingIds]);

  // Build tree from filtered employees
  const { tree, flatList, breadcrumb } = useMemo(() => {
    // Filter to visible employees only
    const visibleEmployees = employees.filter(e => filterResult.isVisible(e.id));
    
    let treeData;
    let crumb = [];
    
    if (focusedEmployeeId) {
      // Show subtree rooted at focused employee
      treeData = getSubtree(focusedEmployeeId, visibleEmployees);
      crumb = getBreadcrumbPath(focusedEmployeeId, employees);
    } else {
      treeData = buildEmployeeTree(visibleEmployees);
    }
    
    const flat = flattenTree(treeData, expandedIds);
    return { tree: treeData, flatList: flat, breadcrumb: crumb };
  }, [employees, filterResult, expandedIds, focusedEmployeeId]);

  // Initialize default expansion (depth 0 and 1) on first load
  useEffect(() => {
    if (!hasInitialized && tree.length > 0 && !search && !focusedEmployeeId) {
      setExpandedIds(getDefaultExpandedIds(tree));
      setHasInitialized(true);
    }
  }, [tree, hasInitialized, search, focusedEmployeeId]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(employees.map(e => e.id));
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    // Collapse to default 2-level view
    setExpandedIds(getDefaultExpandedIds(tree));
  };

  const handleFocus = (employeeId) => {
    setFocusedEmployeeId(employeeId);
    setExpandedIds(new Set()); // Reset expansion when focusing
  };

  const resetFocus = () => {
    setFocusedEmployeeId(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
        <p className="mt-2 text-slate-500">Loading employees...</p>
      </div>
    );
  }

  if (flatList.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
        No employees found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Breadcrumb for focused view */}
      {focusedEmployeeId && breadcrumb.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={resetFocus} className="text-slate-600 h-7 px-2">
            <RotateCcw className="h-3 w-3 mr-1" />
            Full Directory
          </Button>
          <span className="text-slate-300">|</span>
          {breadcrumb.map((emp, idx) => (
            <React.Fragment key={emp.id}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
              <button
                onClick={() => handleFocus(emp.id)}
                className={cn(
                  "hover:text-indigo-600 transition-colors",
                  emp.id === focusedEmployeeId ? "font-medium text-slate-900" : "text-slate-600"
                )}
              >
                {emp.first_name} {emp.last_name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-600">{flatList.length} visible</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">
            Collapse All
          </Button>
        </div>
      </div>

      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Job Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Department</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            <th className="px-6 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {flatList.map((emp) => {
            const isExpanded = expandedIds.has(emp.id);
            const isMatch = filterResult.isMatch(emp.id);
            const isContextOnly = !isMatch && search;
            
            return (
              <tr 
                key={emp.id} 
                className={cn(
                  "hover:bg-slate-50 cursor-pointer transition-colors",
                  isContextOnly && "opacity-50"
                )}
                onClick={() => onRowClick(emp)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center" style={{ paddingLeft: `${emp.depth * 24}px` }}>
                    {/* Expand/collapse toggle */}
                    <button
                      onClick={(e) => toggleExpand(emp.id, e)}
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 mr-2 transition-colors",
                        !emp.hasChildren && "invisible"
                      )}
                    >
                      {emp.hasChildren && (
                        isExpanded 
                          ? <ChevronDown className="h-4 w-4 text-slate-500" />
                          : <ChevronRight className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                    
                    <Avatar firstName={emp.first_name} lastName={emp.last_name} size="md" />
                    <div className="ml-3">
                      <div className={cn(
                        "text-sm font-medium",
                        isMatch && search ? "text-indigo-700 bg-indigo-50 px-1 -mx-1 rounded" : "text-slate-900"
                      )}>
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-sm text-slate-500">{emp.email}</div>
                      {emp.hasChildren && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {emp.children.length} direct report{emp.children.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {emp.job_title || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {getDeptName(emp.department_id)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {getLocName(emp.location_id)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={emp.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleFocus(emp.id); }}>
                        <Focus className="h-4 w-4 mr-2" />
                        View this team
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl('EmployeeProfile') + `?id=${emp.id}&tab=leave`} onClick={(e) => e.stopPropagation()}>
                          <Calendar className="h-4 w-4 mr-2" />
                          View leave
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={createPageUrl('OrgChart') + `?focus=${emp.id}`} onClick={(e) => e.stopPropagation()}>
                          <Users className="h-4 w-4 mr-2" />
                          View in Org Chart
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}