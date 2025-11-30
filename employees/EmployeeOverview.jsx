import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { format } from 'date-fns';

export function EmployeeOverview({ employee, department, location, manager }) {
  const formatDate = (d) => d ? format(new Date(d), 'dd MMMM yyyy') : '—';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Employment</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Department</dt>
              <dd className="text-gray-900">{department?.name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Location</dt>
              <dd className="text-gray-900">{location?.name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Manager</dt>
              <dd className="text-gray-900">
                {manager ? `${manager.first_name} ${manager.last_name}` : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Employment Type</dt>
              <dd className="text-gray-900 capitalize">{employee.employment_type?.replace('_', ' ') || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Start Date</dt>
              <dd className="text-gray-900">{formatDate(employee.start_date)}</dd>
            </div>
            {employee.end_date && (
              <div className="flex justify-between">
                <dt className="text-gray-500">End Date</dt>
                <dd className="text-gray-900">{formatDate(employee.end_date)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Work Email</dt>
              <dd className="text-gray-900">{employee.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Personal Email</dt>
              <dd className="text-gray-900">{employee.personal_email || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-900">{employee.phone || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Date of Birth</dt>
              <dd className="text-gray-900">{formatDate(employee.date_of_birth)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}