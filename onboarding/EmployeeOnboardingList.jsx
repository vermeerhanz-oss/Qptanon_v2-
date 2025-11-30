import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from '../ui/Avatar';
import { Badge, StatusBadge } from '../ui/Badge';
import { Search, UserPlus, Eye } from 'lucide-react';

export function EmployeeOnboardingList({ 
  employees, 
  instances, 
  departments, 
  tasks, 
  isAdmin, 
  onStartOnboarding 
}) {
  const [search, setSearch] = useState('');

  const getDepartment = (deptId) => departments.find(d => d.id === deptId);

  const getOnboardingStatus = (empId) => {
    const empInstances = instances.filter(i => i.employee_id === empId);
    if (empInstances.length === 0) return null;
    
    // Return active instance first, otherwise most recent
    const active = empInstances.find(i => i.status === 'in_progress' || i.status === 'not_started');
    return active || empInstances.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    )[0];
  };

  const getProgress = (instanceId) => {
    const instanceTasks = tasks.filter(t => t.instance_id === instanceId);
    if (instanceTasks.length === 0) return null;
    const completed = instanceTasks.filter(t => t.status === 'done').length;
    return {
      completed,
      total: instanceTasks.length,
      percent: Math.round((completed / instanceTasks.length) * 100),
    };
  };

  const filteredEmployees = employees.filter(emp => {
    if (emp.status === 'terminated') return false;
    if (!search) return true;
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase()) || emp.email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Onboarding Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEmployees.map((emp) => {
              const instance = getOnboardingStatus(emp.id);
              const progress = instance ? getProgress(instance.id) : null;
              const hasActiveOnboarding = instance && (instance.status === 'in_progress' || instance.status === 'not_started');

              return (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar firstName={emp.first_name} lastName={emp.last_name} size="sm" />
                      <div>
                        <Link 
                          to={createPageUrl(`EmployeeProfile?id=${emp.id}`)}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {emp.first_name} {emp.last_name}
                        </Link>
                        <p className="text-xs text-gray-500">{emp.job_title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {getDepartment(emp.department_id)?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {instance ? (
                      <StatusBadge status={instance.status} />
                    ) : (
                      <Badge variant="default">Not Started</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {progress ? (
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
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={createPageUrl(`EmployeeProfile?id=${emp.id}`)}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      {isAdmin && !hasActiveOnboarding && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onStartOnboarding(emp)}
                          className="text-green-600 border-green-200 hover:bg-green-50"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredEmployees.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No employees found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}