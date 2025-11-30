import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/Badge';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import { GoogleStatusIcon } from '@/components/google/GoogleStatusIndicator';
import { Calendar } from 'lucide-react';

export function EmployeeTable({ employees, departments, locations, isLoading, onRowClick }) {
  const getDeptName = (id) => departments.find(d => d.id === id)?.name || '—';
  const getLocName = (id) => locations.find(l => l.id === id)?.name || '—';

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-2 text-gray-500">Loading employees...</p>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No employees found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">G</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onRowClick(emp)}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <Avatar firstName={emp.preferred_name || emp.first_name} lastName={emp.last_name} size="md" />
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{getDisplayName(emp)}</div>
                    <div className="text-sm text-gray-500">{emp.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.job_title || '—'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDeptName(emp.department_id)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getLocName(emp.location_id)}</td>
              <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={emp.status} /></td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <GoogleStatusIcon status={emp.google_sync_status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Link
                  to={createPageUrl('EmployeeProfile') + `?id=${emp.id}&tab=leave`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  View leave
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}