import React, { useState, useMemo } from 'react';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Users, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToCsv } from '@/components/utils/exportCsv';

const EMPLOYMENT_LABELS = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  casual: 'Casual',
  contractor: 'Contractor',
};

const PAGE_SIZE = 25;

export default function PeopleSummaryTable({ employees, deptMap, locMap, entityMap, empMap, canViewSensitive = false, documentCounts = {} }) {
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const getDisplayName = (emp) => {
    const first = emp.preferred_name || emp.first_name || '';
    return `${first} ${emp.last_name || ''}`.trim();
  };

  const getInitials = (emp) => {
    const first = (emp.preferred_name || emp.first_name || '?')[0];
    const last = (emp.last_name || '?')[0];
    return `${first}${last}`.toUpperCase();
  };

  const sortedEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'name':
          aVal = getDisplayName(a).toLowerCase();
          bVal = getDisplayName(b).toLowerCase();
          break;
        case 'department':
          aVal = (deptMap[a.department_id]?.name || '').toLowerCase();
          bVal = (deptMap[b.department_id]?.name || '').toLowerCase();
          break;
        case 'entity':
          aVal = (entityMap[a.entity_id]?.name || '').toLowerCase();
          bVal = (entityMap[b.entity_id]?.name || '').toLowerCase();
          break;
        case 'employment_type':
          aVal = a.employment_type || '';
          bVal = b.employment_type || '';
          break;
        default:
          aVal = '';
          bVal = '';
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [employees, sortField, sortDir, deptMap, entityMap]);

  // Pagination
  const totalPages = Math.ceil(sortedEmployees.length / PAGE_SIZE);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedEmployees.slice(start, start + PAGE_SIZE);
  }, [sortedEmployees, currentPage]);

  // Reset to page 1 when employees change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [employees.length]);

  // CSV Export
  const handleExportCSV = () => {
    const baseColumns = [
      { key: 'first_name', label: 'first_name' },
      { key: 'last_name', label: 'last_name' },
      { key: 'preferred_name', label: 'preferred_name' },
      { key: 'email', label: 'email' },
      { key: 'job_title', label: 'job_title' },
      { key: 'department', label: 'department' },
      { key: 'location', label: 'location' },
      { key: 'entity', label: 'entity' },
      { key: 'employment_type', label: 'employment_type' },
      { key: 'status', label: 'status' },
      { key: 'manager_name', label: 'manager_name' },
      { key: 'document_count', label: 'document_count' },
    ];
    
    const columns = canViewSensitive 
      ? [...baseColumns, 
          { key: 'base_salary', label: 'base_salary' },
          { key: 'salary_currency', label: 'salary_currency' },
          { key: 'pay_cycle', label: 'pay_cycle' },
        ]
      : baseColumns;

    const rows = sortedEmployees.map(emp => {
      const manager = empMap[emp.manager_id];
      const managerName = manager ? `${manager.preferred_name || manager.first_name || ''} ${manager.last_name || ''}`.trim() : '';
      
      const row = {
        first_name: emp.first_name || '',
        last_name: emp.last_name || '',
        preferred_name: emp.preferred_name || '',
        email: emp.email || '',
        job_title: emp.job_title || '',
        department: deptMap[emp.department_id]?.name || '',
        location: locMap[emp.location_id]?.name || '',
        entity: entityMap[emp.entity_id]?.name || '',
        employment_type: EMPLOYMENT_LABELS[emp.employment_type] || emp.employment_type || '',
        status: emp.status || '',
        manager_name: managerName,
        document_count: documentCounts[emp.id] || 0,
      };
      
      if (canViewSensitive) {
        row.base_salary = emp.base_salary || '';
        row.salary_currency = emp.salary_currency || '';
        row.pay_cycle = emp.pay_cycle || '';
      }
      
      return row;
    });

    exportToCsv({ filename: 'people-summary', columns, rows });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ field, children, className = '' }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No employees match the selected filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {/* Header with export */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-gray-600">
          {sortedEmployees.length} employee{sortedEmployees.length !== 1 ? 's' : ''}
        </span>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <SortHeader field="name" className="w-64">Name</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
              <SortHeader field="department">Department</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <SortHeader field="entity">Entity</SortHeader>
              <SortHeader field="employment_type">Type</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedEmployees.map((emp) => {
              const manager = empMap[emp.manager_id];
              const managerName = manager ? `${manager.preferred_name || manager.first_name} ${manager.last_name}` : '—';
              return (
                <tr
                  key={emp.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = createPageUrl(`EmployeeProfile?id=${emp.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                          {getInitials(emp)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{getDisplayName(emp)}</p>
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{emp.job_title || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{deptMap[emp.department_id]?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{locMap[emp.location_id]?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{entityMap[emp.entity_id]?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{EMPLOYMENT_LABELS[emp.employment_type] || emp.employment_type || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{managerName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={emp.status === 'active' ? 'success' : 'secondary'}>
                      {emp.status === 'active' ? 'Active' : emp.status || 'Unknown'}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}