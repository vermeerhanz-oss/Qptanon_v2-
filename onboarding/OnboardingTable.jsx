import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from '../ui/Badge';
import { format, isPast, parseISO } from 'date-fns';
import { Eye, X, Loader2 } from 'lucide-react';

export function OnboardingTable({ 
  items, 
  employees, 
  departments, 
  tasks, 
  type, 
  onCancel, 
  cancellingId, 
  isAdmin 
}) {
  const getEmployee = (id) => employees.find(e => e.id === id);
  const getManager = (emp) => emp?.manager_id ? employees.find(e => e.id === emp.manager_id) : null;
  const getDepartment = (emp) => emp?.department_id ? departments.find(d => d.id === emp.department_id) : null;

  const getProgress = (instanceId) => {
    const instanceTasks = tasks.filter(t => t.instance_id === instanceId);
    if (instanceTasks.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = instanceTasks.filter(t => t.status === 'done').length;
    return {
      completed,
      total: instanceTasks.length,
      percent: Math.round((completed / instanceTasks.length) * 100),
    };
  };

  const isOverdue = (instance) => {
    if (!instance.due_date) return false;
    return isPast(parseISO(instance.due_date)) && instance.status !== 'completed';
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No onboarding records found in this category.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
            {type !== 'completed' && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
            )}
            {type !== 'completed' && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
            )}
            {type === 'completed' && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((instance) => {
            const emp = getEmployee(instance.employee_id);
            const manager = getManager(emp);
            const dept = getDepartment(emp);
            const progress = getProgress(instance.id);
            const overdue = isOverdue(instance);

            return (
              <tr key={instance.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link 
                    to={createPageUrl(`EmployeeProfile?id=${instance.employee_id}`)}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}
                  </Link>
                  <p className="text-xs text-gray-500">{emp?.job_title}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {manager ? `${manager.first_name} ${manager.last_name}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {dept?.name || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {instance.start_date ? format(parseISO(instance.start_date), 'MMM d, yyyy') : '—'}
                </td>
                {type !== 'completed' && (
                  <td className="px-4 py-3 text-sm">
                    <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {instance.due_date ? format(parseISO(instance.due_date), 'MMM d, yyyy') : '—'}
                    </span>
                    {overdue && <Badge variant="danger" className="ml-2">Overdue</Badge>}
                  </td>
                )}
                {type !== 'completed' && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                  </td>
                )}
                {type === 'completed' && (
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {instance.updated_date ? format(parseISO(instance.updated_date), 'MMM d, yyyy') : '—'}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatusBadge status={instance.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link to={createPageUrl(`EmployeeProfile?id=${instance.employee_id}`)}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    {isAdmin && type !== 'completed' && instance.status !== 'cancelled' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onCancel(instance)}
                        disabled={cancellingId === instance.id}
                      >
                        {cancellingId === instance.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
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
  );
}