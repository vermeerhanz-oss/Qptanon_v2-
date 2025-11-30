import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Download, Check, X, Users, Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const METHOD_LABELS = {
  in_app: 'In App',
  imported: 'Imported',
  paper_record: 'Paper Record',
};

export default function PolicyAcknowledgementReport({
  employees,
  acknowledgements,
  departments,
  entities,
  latestVersion,
  policyEntityId,
  policyCountry,
  policyDocumentFilename,
}) {
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Get employees in scope for this policy
  const employeesInScope = useMemo(() => {
    return employees.filter(emp => {
      if (emp.status === 'terminated') return false;
      if (policyEntityId && emp.entity_id !== policyEntityId) return false;
      if (policyCountry && emp.country && emp.country !== policyCountry) return false;
      return true;
    });
  }, [employees, policyEntityId, policyCountry]);

  // Build report data
  const reportData = useMemo(() => {
    if (!latestVersion) return [];

    return employeesInScope.map(emp => {
      const ack = acknowledgements.find(a => 
        a.employee_id === emp.id && a.version_id === latestVersion.id
      );
      const dept = departments.find(d => d.id === emp.department_id);
      const entity = entities.find(e => e.id === emp.entity_id);

      return {
        employee: emp,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        department: dept?.name || '—',
        departmentId: emp.department_id,
        entity: entity?.name || '—',
        entityId: emp.entity_id,
        isAcknowledged: !!ack,
        acknowledgedAt: ack?.acknowledged_at,
        method: ack?.method,
      };
    });
  }, [employeesInScope, acknowledgements, latestVersion, departments, entities]);

  // Apply filters
  const filteredData = useMemo(() => {
    return reportData.filter(row => {
      if (filterDepartment !== 'all' && row.departmentId !== filterDepartment) return false;
      if (filterEntity !== 'all' && row.entityId !== filterEntity) return false;
      if (filterStatus === 'acknowledged' && !row.isAcknowledged) return false;
      if (filterStatus === 'not_acknowledged' && row.isAcknowledged) return false;
      return true;
    });
  }, [reportData, filterDepartment, filterEntity, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const acknowledged = filteredData.filter(r => r.isAcknowledged).length;
    const percentage = total > 0 ? Math.round((acknowledged / total) * 100) : 0;
    return { total, acknowledged, percentage };
  }, [filteredData]);

  // Unique departments and entities for filters
  const uniqueDepartments = useMemo(() => {
    const deptIds = [...new Set(reportData.map(r => r.departmentId).filter(Boolean))];
    return departments.filter(d => deptIds.includes(d.id));
  }, [reportData, departments]);

  const uniqueEntities = useMemo(() => {
    const entIds = [...new Set(reportData.map(r => r.entityId).filter(Boolean))];
    return entities.filter(e => entIds.includes(e.id));
  }, [reportData, entities]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Employee', 'Department', 'Entity', 'Acknowledged', 'Acknowledged At', 'Method'];
    if (policyDocumentFilename) {
      headers.push('Policy Document');
    }
    const rows = filteredData.map(row => {
      const rowData = [
        row.employeeName,
        row.department,
        row.entity,
        row.isAcknowledged ? 'Yes' : 'No',
        row.acknowledgedAt ? format(parseISO(row.acknowledgedAt), 'yyyy-MM-dd HH:mm') : '',
        row.method ? METHOD_LABELS[row.method] || row.method : '',
      ];
      if (policyDocumentFilename) {
        rowData.push(policyDocumentFilename);
      }
      return rowData;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policy-acknowledgements-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!latestVersion) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No published version to report on.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Acknowledgement Report</h3>
            <p className="text-xs text-gray-500 mt-0.5">Version {latestVersion.version_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{stats.acknowledged}</span>
              <span className="text-gray-400">/</span>
              <span>{stats.total}</span>
              <Badge className="ml-2 bg-indigo-100 text-indigo-700">{stats.percentage}%</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Filters:</span>
          </div>
          
          {uniqueDepartments.length > 0 && (
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {uniqueDepartments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {uniqueEntities.length > 0 && (
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {uniqueEntities.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="not_acknowledged">Not acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acknowledged</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acknowledged At</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                filteredData.map(row => (
                  <tr key={row.employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.employeeName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.entity}</td>
                    <td className="px-4 py-3 text-center">
                      {row.isAcknowledged ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.acknowledgedAt 
                        ? format(parseISO(row.acknowledgedAt), 'MMM d, yyyy h:mm a')
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.method ? METHOD_LABELS[row.method] || row.method : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}