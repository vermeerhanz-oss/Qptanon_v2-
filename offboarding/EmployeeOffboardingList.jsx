import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Play, Ban } from 'lucide-react';

export function EmployeeOffboardingList({ 
  employees, 
  instances, 
  departments, 
  tasks,
  isAdmin,
  onStartOffboarding 
}) {
  const getManager = (managerId) => employees.find(e => e.id === managerId);
  const getDepartment = (deptId) => departments.find(d => d.id === deptId);
  
  // Active = not_started or in_progress (blocks new offboarding)
  const getActiveInstance = (empId) => {
    return instances.find(i => 
      i.employee_id === empId && 
      (i.status === 'not_started' || i.status === 'in_progress')
    );
  };

  // Get most recent historical instance (completed or cancelled)
  const getLatestHistoricalInstance = (empId) => {
    const historical = instances
      .filter(i => i.employee_id === empId && (i.status === 'completed' || i.status === 'cancelled'))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    return historical[0] || null;
  };
  
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

  // Filter to active employees only (not terminated)
  const activeEmployees = employees.filter(e => e.status !== 'terminated');

  if (activeEmployees.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No active employees found
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {activeEmployees.map(employee => {
              const activeInstance = getActiveInstance(employee.id);
              const historicalInstance = getLatestHistoricalInstance(employee.id);
              const manager = getManager(employee.manager_id);
              const dept = getDepartment(employee.department_id);
              const progress = activeInstance ? getProgress(activeInstance.id) : 0;

              // Show Start Offboarding if no active instance exists (even if cancelled/completed history exists)
              const canStartOffboarding = !activeInstance && isAdmin;

              return (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{employee.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {manager ? `${manager.first_name} ${manager.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {dept?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {activeInstance ? (
                      getStatusBadge(activeInstance.status)
                    ) : historicalInstance ? (
                      <div className="flex items-center gap-1">
                        {getStatusBadge(historicalInstance.status)}
                        <span className="text-xs text-gray-400">(previous)</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {activeInstance ? (
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
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {activeInstance ? (
                        <Link to={createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=offboarding`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View Offboarding
                          </Button>
                        </Link>
                      ) : canStartOffboarding ? (
                        <Button 
                          size="sm" 
                          onClick={() => onStartOffboarding(employee)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start Offboarding
                        </Button>
                      ) : historicalInstance ? (
                        <Link to={createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=offboarding`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View History
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
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