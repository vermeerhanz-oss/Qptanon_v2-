import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  ExternalLink, Filter, Loader2, Users, Calendar, Building2, Download
} from 'lucide-react';
import { exportToCsv } from '@/components/utils/exportCsv';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import { getOnboardingProgress } from '@/components/onboarding/onboardingEngine';

const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const Employee = base44.entities.Employee;
const Document = base44.entities.Document;

const STATUS_BADGES = {
  not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700' },
};

export default function OnboardingRunsTable({ userContext, entities, employees }) {
  const [onboardings, setOnboardings] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [docCountMap, setDocCountMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [entityFilter, setEntityFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Build lookup maps
  const employeeMap = React.useMemo(() => {
    const map = {};
    employees.forEach(e => { map[e.id] = e; });
    return map;
  }, [employees]);

  const entityMap = React.useMemo(() => {
    const map = {};
    entities.forEach(e => { map[e.id] = e; });
    return map;
  }, [entities]);

  // Get unique managers from onboardings
  const managers = React.useMemo(() => {
    const managerIds = new Set();
    onboardings.forEach(o => {
      if (o.manager_id) managerIds.add(o.manager_id);
    });
    return Array.from(managerIds).map(id => employeeMap[id]).filter(Boolean);
  }, [onboardings, employeeMap]);

  useEffect(() => {
    loadOnboardings();
  }, []);

  const loadOnboardings = async () => {
    setIsLoading(true);
    try {
      const [allOnboardings, allDocs] = await Promise.all([
        EmployeeOnboarding.list('-created_date'),
        Document.list(),
      ]);
      setOnboardings(allOnboardings);

      // Build doc count map by onboarding task
      const docCounts = {};
      allOnboardings.forEach(o => { docCounts[o.id] = 0; });
      allDocs.forEach(doc => {
        if (doc.related_onboarding_task_id) {
          // Find the onboarding this task belongs to
          // We need to count docs per onboarding, so we'll iterate onboardings
        }
      });
      // Group docs by onboarding via employee
      const docsByEmployee = {};
      allDocs.forEach(doc => {
        if (doc.related_onboarding_task_id && doc.owner_employee_id) {
          docsByEmployee[doc.owner_employee_id] = (docsByEmployee[doc.owner_employee_id] || 0) + 1;
        }
      });
      allOnboardings.forEach(o => {
        docCounts[o.id] = docsByEmployee[o.employee_id] || 0;
      });
      setDocCountMap(docCounts);

      // Load progress for each
      const progress = {};
      await Promise.all(allOnboardings.map(async (o) => {
        try {
          progress[o.id] = await getOnboardingProgress(o.id);
        } catch (e) {
          progress[o.id] = { percentage: 0, requiredPercentage: 0 };
        }
      }));
      setProgressMap(progress);
    } catch (error) {
      console.error('Error loading onboardings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters
  const filteredOnboardings = React.useMemo(() => {
    return onboardings.filter(o => {
      if (entityFilter !== 'all' && o.entity_id !== entityFilter) return false;
      if (managerFilter !== 'all' && o.manager_id !== managerFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      return true;
    });
  }, [onboardings, entityFilter, managerFilter, statusFilter]);

  // CSV Export
  const handleExportCSV = () => {
    const columns = [
      { key: 'employee_name', label: 'employee_name' },
      { key: 'job_title', label: 'job_title' },
      { key: 'start_date', label: 'start_date' },
      { key: 'manager', label: 'manager' },
      { key: 'entity', label: 'entity' },
      { key: 'department', label: 'department' },
      { key: 'status', label: 'status' },
      { key: 'progress_percent', label: 'progress_percent' },
      { key: 'onboarding_documents', label: 'onboarding_documents' },
    ];

    const rows = filteredOnboardings.map(o => {
      const emp = employeeMap[o.employee_id];
      const manager = employeeMap[o.manager_id];
      const entity = entityMap[o.entity_id];
      const progress = progressMap[o.id] || { requiredPercentage: 0 };
      
      return {
        employee_name: emp ? getDisplayName(emp) : 'Unknown',
        job_title: emp?.job_title || '',
        start_date: o.start_date || '',
        manager: manager ? getDisplayName(manager) : '',
        entity: entity?.name || '',
        department: o.department || '',
        status: STATUS_BADGES[o.status]?.label || o.status || '',
        progress_percent: progress.requiredPercentage || 0,
        onboarding_documents: docCountMap[o.id] || 0,
      };
    });

    exportToCsv({ filename: 'onboarding-runs', columns, rows });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Onboarding Runs
            <Badge variant="secondary">{filteredOnboardings.length}</Badge>
          </CardTitle>
          
          {/* Filters & Export */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Managers</SelectItem>
                {managers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{getDisplayName(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredOnboardings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No onboarding runs found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-gray-500">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Start Date</th>
                  <th className="pb-3 font-medium">Manager</th>
                  <th className="pb-3 font-medium">Entity / Dept</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Progress</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOnboardings.map(o => {
                  const emp = employeeMap[o.employee_id];
                  const manager = employeeMap[o.manager_id];
                  const entity = entityMap[o.entity_id];
                  const progress = progressMap[o.id] || { percentage: 0, requiredPercentage: 0 };
                  const statusConfig = STATUS_BADGES[o.status] || STATUS_BADGES.not_started;

                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                            {emp ? getInitials(emp) : '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {emp ? getDisplayName(emp) : 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">{emp?.job_title || 'New Hire'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {o.start_date}
                        </div>
                      </td>
                      <td className="py-3 text-sm text-gray-600">
                        {manager ? getDisplayName(manager) : '-'}
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Building2 className="h-4 w-4" />
                          {entity?.name || '-'}
                        </div>
                        {o.department && (
                          <p className="text-xs text-gray-400">{o.department}</p>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="w-24">
                          <div className="flex items-center gap-2">
                            <Progress value={progress.requiredPercentage} className="h-2" />
                            <span className="text-xs text-gray-500">{progress.requiredPercentage}%</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {progress.requiredCompleted}/{progress.requiredTotal} required
                          </p>
                        </div>
                      </td>
                      <td className="py-3">
                        <Link to={createPageUrl('OnboardingDetail') + `?id=${o.id}`}>
                          <Button variant="ghost" size="sm" className="flex items-center gap-1">
                            Open
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}