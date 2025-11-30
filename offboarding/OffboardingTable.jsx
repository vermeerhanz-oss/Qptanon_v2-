import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, XCircle, Calendar } from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { MessageSquare, AlertCircle } from 'lucide-react';

export function OffboardingTable({ 
  items, 
  employees, 
  departments, 
  tasks, 
  type, 
  onCancel, 
  cancellingId,
  isAdmin,
  onViewExitInterview
}) {
  const getEmployee = (empId) => employees.find(e => e.id === empId);
  const getManager = (managerId) => employees.find(e => e.id === managerId);
  const getDepartment = (deptId) => departments.find(d => d.id === deptId);
  
  const getInstanceTasks = (instanceId) => tasks.filter(t => t.instance_id === instanceId);
  
  const getProgress = (instanceId) => {
    const instanceTasks = getInstanceTasks(instanceId);
    if (instanceTasks.length === 0) return 0;
    const done = instanceTasks.filter(t => t.status === 'done').length;
    return Math.round((done / instanceTasks.length) * 100);
  };

  const getStatusBadge = (status) => {
    const config = {
      not_started: { className: 'bg-yellow-100 text-yellow-700', label: 'Not Started' },
      in_progress: { className: 'bg-blue-100 text-blue-700', label: 'In Progress' },
      completed: { className: 'bg-green-100 text-green-700', label: 'Completed' },
      cancelled: { className: 'bg-gray-100 text-gray-700', label: 'Cancelled' },
    };
    const c = config[status] || config.not_started;
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const getFinalDayDisplay = (instance, employee) => {
    const finalDay = instance.final_day || employee?.end_date;
    if (!finalDay) return <span className="text-gray-400">Not set</span>;
    
    const date = new Date(finalDay);
    const formattedDate = format(date, 'MMM d, yyyy');
    
    if (type === 'upcoming') {
      const distance = formatDistanceToNow(date, { addSuffix: true });
      const isUrgent = isPast(date) || isToday(date);
      return (
        <div>
          <p className={`font-medium ${isUrgent ? 'text-red-600' : 'text-gray-900'}`}>{formattedDate}</p>
          <p className={`text-xs ${isUrgent ? 'text-red-500' : 'text-gray-500'}`}>{distance}</p>
        </div>
      );
    }
    
    return <span className="text-gray-900">{formattedDate}</span>;
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No offboardings in this category
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Final Day</th>
              {type !== 'completed' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                </>
              )}
              {type === 'completed' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Interview</th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(instance => {
              const employee = getEmployee(instance.employee_id);
              const manager = employee ? getManager(employee.manager_id) : null;
              const dept = employee ? getDepartment(employee.department_id) : null;
              const progress = getProgress(instance.id);
              const canCancel = isAdmin && (instance.status === 'not_started' || instance.status === 'in_progress');

              return (
                <tr key={instance.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">{employee?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {manager ? `${manager.first_name} ${manager.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {dept?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getFinalDayDisplay(instance, employee)}
                  </td>
                  {type !== 'completed' && (
                    <>
                      <td className="px-4 py-3">
                        {getStatusBadge(instance.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </>
                  )}
                  {type === 'completed' && (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {instance.updated_date ? format(new Date(instance.updated_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {instance.exit_interview_completed_at ? (
                          <button
                            onClick={() => onViewExitInterview && onViewExitInterview(instance, employee)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Completed
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-gray-400">
                            <AlertCircle className="h-3 w-3" />
                            Not recorded
                          </span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={createPageUrl('EmployeeProfile') + `?id=${instance.employee_id}&tab=offboarding`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </Link>
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => onCancel(instance)}
                          disabled={cancellingId === instance.id}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}