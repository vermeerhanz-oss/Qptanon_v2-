import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, ChevronRight, Download, Sun, Thermometer, FileText
} from 'lucide-react';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import { exportToCsv } from '@/components/utils/exportCsv';
import { formatDays, safeNumber } from '@/components/utils/numberUtils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, parseISO } from 'date-fns';

export default function LeaveSummaryTable({
  filteredRequests,
  chargeableDaysMap,
  visibleEmployees,
  departments,
  entities,
  getLeaveTypeCategory,
  leaveTypes = [],
  canApproveLeave = false,
}) {
  const [sortField, setSortField] = useState('totalDays');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Build per-employee summary
  const employeeSummaries = useMemo(() => {
    const approvedRequests = filteredRequests.filter(r => r.status === 'approved');
    const pendingRequests = filteredRequests.filter(r => r.status === 'pending');

    // Group by employee
    const summaryMap = {};

    // Initialize with all visible employees who have any requests
    const employeesWithRequests = new Set([
      ...approvedRequests.map(r => r.employee_id),
      ...pendingRequests.map(r => r.employee_id),
    ]);

    employeesWithRequests.forEach(empId => {
      const emp = visibleEmployees.find(e => e.id === empId);
      if (!emp) return;

      const empApproved = approvedRequests.filter(r => r.employee_id === empId);
      const empPending = pendingRequests.filter(r => r.employee_id === empId);

      const annualDays = empApproved
        .filter(r => getLeaveTypeCategory(r.leave_type_id) === 'annual')
        .reduce((sum, r) => sum + (chargeableDaysMap[r.id] ?? r.total_days ?? 0), 0);

      const personalDays = empApproved
        .filter(r => getLeaveTypeCategory(r.leave_type_id) === 'personal')
        .reduce((sum, r) => sum + (chargeableDaysMap[r.id] ?? r.total_days ?? 0), 0);

      const department = departments.find(d => d.id === emp.department_id);
      const entity = entities.find(e => e.id === emp.entity_id);

      summaryMap[empId] = {
        employee: emp,
        department,
        entity,
        annualDays,
        personalDays,
        totalDays: annualDays + personalDays,
        pendingCount: empPending.length,
        requests: [...empApproved, ...empPending],
      };
    });

    return Object.values(summaryMap);
  }, [filteredRequests, chargeableDaysMap, visibleEmployees, departments, entities, getLeaveTypeCategory]);

  // Sort
  const sortedSummaries = useMemo(() => {
    return [...employeeSummaries].sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'name':
          aVal = getDisplayName(a.employee).toLowerCase();
          bVal = getDisplayName(b.employee).toLowerCase();
          break;
        case 'department':
          aVal = a.department?.name?.toLowerCase() || '';
          bVal = b.department?.name?.toLowerCase() || '';
          break;
        case 'entity':
          aVal = a.entity?.name?.toLowerCase() || '';
          bVal = b.entity?.name?.toLowerCase() || '';
          break;
        case 'totalDays':
        default:
          aVal = a.totalDays;
          bVal = b.totalDays;
          break;
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [employeeSummaries, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-indigo-600" />
      : <ArrowDown className="h-3 w-3 text-indigo-600" />;
  };

  // Get leave type name
  const getLeaveTypeName = (leaveTypeId) => {
    const lt = leaveTypes.find(t => t.id === leaveTypeId);
    return lt?.name || 'Unknown';
  };

  // CSV Export
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const columns = [
        { key: 'first_name', label: 'employee_first_name' },
        { key: 'last_name', label: 'employee_last_name' },
        { key: 'preferred_name', label: 'preferred_name' },
        { key: 'email', label: 'email' },
        { key: 'department', label: 'department' },
        { key: 'entity', label: 'entity' },
        { key: 'employment_type', label: 'employment_type' },
        { key: 'annual_leave_days', label: 'annual_leave_days_taken' },
        { key: 'personal_leave_days', label: 'personal_leave_days_taken' },
        { key: 'total_leave_days', label: 'total_leave_days' },
        { key: 'pending_count', label: 'pending_request_count' },
      ];

      const rows = sortedSummaries.map(row => ({
        first_name: row.employee.first_name || '',
        last_name: row.employee.last_name || '',
        preferred_name: row.employee.preferred_name || '',
        email: row.employee.email || '',
        department: row.department?.name || '',
        entity: row.entity?.name || '',
        employment_type: row.employee.employment_type || '',
        annual_leave_days: formatDays(safeNumber(row.annualDays, 0)),
        personal_leave_days: formatDays(safeNumber(row.personalDays, 0)),
        total_leave_days: formatDays(safeNumber(row.totalDays, 0)),
        pending_count: row.pendingCount,
      }));

      exportToCsv({ filename: 'leave-summary', columns, rows });
    } finally {
      setIsExporting(false);
    }
  };

  // Count requests by category for selected employee
  const getRequestCounts = (requests) => {
    const annual = requests.filter(r => getLeaveTypeCategory(r.leave_type_id) === 'annual');
    const personal = requests.filter(r => getLeaveTypeCategory(r.leave_type_id) === 'personal');
    return {
      annualCount: annual.filter(r => r.status === 'approved').length,
      personalCount: personal.filter(r => r.status === 'approved').length,
    };
  };

  if (employeeSummaries.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Per-Employee Summary</h3>
              <p className="text-xs text-gray-500 mt-0.5">{employeeSummaries.length} employees with leave</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Employee
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('department')}
                  >
                    <div className="flex items-center gap-1">
                      Department
                      <SortIcon field="department" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('entity')}
                  >
                    <div className="flex items-center gap-1">
                      Entity
                      <SortIcon field="entity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Annual
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Personal
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalDays')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      <SortIcon field="totalDays" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedSummaries.map(row => (
                  <tr 
                    key={row.employee.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedEmployee(row)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs">
                          {getInitials(row.employee)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{getDisplayName(row.employee)}</p>
                          <p className="text-xs text-gray-500">{row.employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.department?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.entity?.abbreviation || row.entity?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {safeNumber(row.annualDays, 0) > 0 ? formatDays(row.annualDays) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {safeNumber(row.personalDays, 0) > 0 ? formatDays(row.personalDays) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatDays(safeNumber(row.totalDays, 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.pendingCount > 0 ? (
                        <Badge className="bg-yellow-100 text-yellow-700">{row.pendingCount}</Badge>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link 
                          to={createPageUrl('EmployeeProfile') + `?id=${row.employee.id}`}
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                        >
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Leave Detail Sheet */}
      <Sheet open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedEmployee && (
                <>
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium">
                    {getInitials(selectedEmployee.employee)}
                  </div>
                  <div>
                    <span>{getDisplayName(selectedEmployee.employee)}</span>
                    <p className="text-sm font-normal text-gray-500">{selectedEmployee.employee.job_title}</p>
                  </div>
                </>
              )}
            </SheetTitle>
          </SheetHeader>
          
          {selectedEmployee && (
            <div className="mt-6 space-y-5">
              {/* Employee Info */}
              <div className="text-sm text-gray-600">
                <p>{selectedEmployee.department?.name || 'No department'} · {selectedEmployee.entity?.name || 'No entity'}</p>
              </div>

              {/* Leave Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sun className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Annual Leave</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-700">{formatDays(safeNumber(selectedEmployee.annualDays, 0))}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {getRequestCounts(selectedEmployee.requests).annualCount} approved request{getRequestCounts(selectedEmployee.requests).annualCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-rose-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="h-4 w-4 text-rose-600" />
                    <span className="text-sm font-medium text-rose-800">Personal Leave</span>
                  </div>
                  <p className="text-2xl font-bold text-rose-700">{formatDays(safeNumber(selectedEmployee.personalDays, 0))}</p>
                  <p className="text-xs text-rose-600 mt-1">
                    {getRequestCounts(selectedEmployee.requests).personalCount} approved request{getRequestCounts(selectedEmployee.requests).personalCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Requests Table */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Leave Requests in Period</h4>
                {selectedEmployee.requests.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No requests found.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {selectedEmployee.requests
                          .sort((a, b) => b.start_date.localeCompare(a.start_date))
                          .map(req => (
                            <tr key={req.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900">
                                {getLeaveTypeName(req.leave_type_id)}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {format(parseISO(req.start_date), 'MMM d')} – {format(parseISO(req.end_date), 'MMM d')}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                {chargeableDaysMap[req.id] ?? req.total_days}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Badge 
                                  className={
                                    req.status === 'approved' 
                                      ? 'bg-green-100 text-green-700'
                                      : req.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : req.status === 'declined'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }
                                >
                                  {req.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {canApproveLeave && (
                  <Link 
                    to={createPageUrl('LeaveApprovals') + `?employee=${selectedEmployee.employee.id}`}
                    target="_blank"
                  >
                    <Button variant="outline" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      View in Leave Approvals
                    </Button>
                  </Link>
                )}
                <Link 
                  to={createPageUrl('EmployeeProfile') + `?id=${selectedEmployee.employee.id}`}
                  target="_blank"
                >
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Full Profile
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}