import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserMinus, Play, Eye, RotateCcw, Calendar, X } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import FinalLeaveSnapshot from './FinalLeaveSnapshot';

const STATUS_CONFIG = {
  not_started: { className: 'bg-slate-100 text-slate-600', label: 'Not Started' },
  draft: { className: 'bg-slate-100 text-slate-700', label: 'Draft' },
  scheduled: { className: 'bg-yellow-100 text-yellow-700', label: 'Scheduled' },
  not_started_legacy: { className: 'bg-yellow-100 text-yellow-700', label: 'Not Started' },
  in_progress: { className: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  completed: { className: 'bg-green-100 text-green-700', label: 'Completed' },
  cancelled: { className: 'bg-gray-100 text-gray-500', label: 'Cancelled' },
};

export function OffboardingEmployeeTable({
  rows, // Array of { employee, offboarding, department, location, manager }
  viewType, // 'pipeline' | 'history'
  onStartOffboarding,
  isAdmin,
}) {
  const [leaveSnapshotEmployee, setLeaveSnapshotEmployee] = useState(null);

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <p className="text-slate-500">
          {viewType === 'pipeline'
            ? 'No employees match your filters'
            : 'No offboarding history found'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Job Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Last Day</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Manager</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(row => {
              const { employee, offboarding, department, location, manager, status } = row;
              const lastDay = offboarding?.final_day || employee?.termination_date;

              return (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                        {getInitials(employee)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{getDisplayName(employee)}</p>
                        <p className="text-sm text-slate-500">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {employee.job_title || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {department?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {location?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {lastDay ? format(new Date(lastDay), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {manager ? getDisplayName(manager) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {status === 'not_started' && isAdmin && (
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => onStartOffboarding(employee)}
                        >
                          <UserMinus className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                      {['draft', 'scheduled', 'in_progress', 'not_started_legacy'].includes(status) && (
                        <>
                          <Link to={createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=offboarding`}>
                            <Button size="sm" variant="outline">
                              <Play className="h-3 w-3 mr-1" />
                              Continue
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLeaveSnapshotEmployee(employee)}
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            Leave
                          </Button>
                        </>
                      )}
                      {['completed', 'cancelled'].includes(status) && (
                        <>
                          <Link to={createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=offboarding`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </Link>
                          {isAdmin && status === 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onStartOffboarding(employee)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restart
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leave Snapshot Modal */}
      {leaveSnapshotEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                Leave Balances - {getDisplayName(leaveSnapshotEmployee)}
              </h3>
              <button 
                onClick={() => setLeaveSnapshotEmployee(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <FinalLeaveSnapshot employeeId={leaveSnapshotEmployee.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}