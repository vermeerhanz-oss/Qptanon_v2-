import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Loader2, UserMinus, Clock, History } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { OffboardingFilters } from '@/components/offboarding/OffboardingFilters';
import OffboardingListTable from '@/components/offboarding/OffboardingListTable';
import StartOffboardingWizard from '@/components/offboarding/StartOffboardingWizard';
import { cn } from "@/lib/utils";

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;
const CompanyEntity = base44.entities.CompanyEntity;
const EmployeeOffboarding = base44.entities.EmployeeOffboarding;
const EmployeeOffboardingTask = base44.entities.EmployeeOffboardingTask;
const Document = base44.entities.Document;

// Pipeline includes active offboardings
const PIPELINE_STATUSES = ['draft', 'scheduled', 'in_progress'];
// History includes completed or cancelled offboardings
const HISTORY_STATUSES = ['completed', 'cancelled'];

export default function Offboarding() {
  const [context, setContext] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [offboardings, setOffboardings] = useState([]);
  const [taskProgress, setTaskProgress] = useState({}); // offboardingId -> { total, completed, requiredTotal, requiredCompleted }
  const [documentCounts, setDocumentCounts] = useState({}); // offboardingId -> doc count
  const [isLoading, setIsLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' | 'history'

  // Filters
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [entityId, setEntityId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exitTypeFilter, setExitTypeFilter] = useState('all');
  const [managerId, setManagerId] = useState('all');

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [startOffboardingEmployee, setStartOffboardingEmployee] = useState(null);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManageOffboarding');

  useEffect(() => {
    loadData();
  }, []);

  // Reset status filter when view mode changes
  useEffect(() => {
    setStatusFilter('all');
  }, [viewMode]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);
      
      if (!ctx.permissions?.canManageOffboarding) {
        setIsLoading(false);
        return;
      }

      const [emps, depts, locs, ents, obs, tasks, docs] = await Promise.all([
        Employee.list(),
        Department.list(),
        Location.list(),
        CompanyEntity.list(),
        EmployeeOffboarding.list(),
        EmployeeOffboardingTask.list(),
        Document.list(),
      ]);

      setEmployees(emps);
      setDepartments(depts);
      setLocations(locs);
      setEntities(ents);
      setOffboardings(obs);

      // Compute task progress for each offboarding
      const progressMap = {};
      for (const ob of obs) {
        const obTasks = tasks.filter(t => t.offboarding_id === ob.id);
        const requiredTasks = obTasks.filter(t => t.required);
        progressMap[ob.id] = {
          total: obTasks.length,
          completed: obTasks.filter(t => t.status === 'completed').length,
          requiredTotal: requiredTasks.length,
          requiredCompleted: requiredTasks.filter(t => t.status === 'completed').length,
        };
      }
      setTaskProgress(progressMap);

      // Build doc count map by offboarding (via employee)
      const docCountMap = {};
      obs.forEach(ob => { docCountMap[ob.id] = 0; });
      docs.forEach(doc => {
        if (doc.related_offboarding_task_id && doc.owner_employee_id) {
          // Find offboarding for this employee
          const ob = obs.find(o => o.employee_id === doc.owner_employee_id);
          if (ob) {
            docCountMap[ob.id] = (docCountMap[ob.id] || 0) + 1;
          }
        }
      });
      setDocumentCounts(docCountMap);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const userIsAdmin = context?.permissions?.canManageCompanySettings || false;

  // Build joined rows: offboarding + employee + lookups + progress
  const allRows = useMemo(() => {
    return offboardings.map(ob => {
      const employee = employees.find(e => e.id === ob.employee_id) || null;
      const department = departments.find(d => d.id === ob.department || d.id === employee?.department_id) || null;
      const entity = entities.find(e => e.id === ob.entity_id || e.id === employee?.entity_id) || null;
      const location = locations.find(l => l.id === employee?.location_id) || null;
      const manager = employees.find(e => e.id === ob.manager_id) || null;
      const progress = taskProgress[ob.id] || { total: 0, completed: 0, requiredTotal: 0, requiredCompleted: 0 };

      return { 
        offboarding: ob, 
        employee, 
        department, 
        entity,
        location, 
        manager, 
        progress,
      };
    });
  }, [offboardings, employees, departments, entities, locations, taskProgress]);

  // Filter rows based on view mode and filters
  const filteredRows = useMemo(() => {
    const viewStatuses = viewMode === 'pipeline' ? PIPELINE_STATUSES : HISTORY_STATUSES;

    return allRows.filter(row => {
      const { offboarding, employee, manager, department, entity } = row;

      // View mode filter
      if (!viewStatuses.includes(offboarding.status)) return false;

      // Status filter within view
      if (statusFilter !== 'all' && offboarding.status !== statusFilter) return false;

      // Exit type filter
      if (exitTypeFilter !== 'all' && offboarding.exit_type !== exitTypeFilter) return false;

      // Manager filter
      if (managerId !== 'all' && offboarding.manager_id !== managerId) return false;

      // Search filter
      if (search && employee) {
        const searchLower = search.toLowerCase();
        const nameMatch = `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchLower);
        const preferredMatch = employee.preferred_name?.toLowerCase().includes(searchLower);
        const emailMatch = employee.email?.toLowerCase().includes(searchLower);
        if (!nameMatch && !preferredMatch && !emailMatch) return false;
      }

      // Department filter
      if (departmentId !== 'all') {
        const deptMatch = department?.id === departmentId || employee?.department_id === departmentId;
        if (!deptMatch) return false;
      }

      // Entity filter
      if (entityId !== 'all') {
        const entMatch = entity?.id === entityId || employee?.entity_id === entityId;
        if (!entMatch) return false;
      }

      return true;
    });
  }, [allRows, viewMode, statusFilter, exitTypeFilter, managerId, search, departmentId, entityId]);

  // Count for header
  const pipelineCount = useMemo(() => {
    return allRows.filter(r => PIPELINE_STATUSES.includes(r.offboarding.status)).length;
  }, [allRows]);

  const historyCount = useMemo(() => {
    return allRows.filter(r => HISTORY_STATUSES.includes(r.offboarding.status)).length;
  }, [allRows]);

  // Get managers that have offboardings for filter
  const managersWithOffboardings = useMemo(() => {
    const managerIds = [...new Set(offboardings.map(o => o.manager_id).filter(Boolean))];
    return employees.filter(e => managerIds.includes(e.id));
  }, [offboardings, employees]);

  const handleStartOffboarding = (employee) => {
    setStartOffboardingEmployee(employee);
    setShowStartModal(true);
  };

  const handleStartSuccess = (offboarding) => {
    setShowStartModal(false);
    setStartOffboardingEmployee(null);
    // Redirect to manage page
    window.location.href = createPageUrl('OffboardingManage') + `?id=${offboarding.id}`;
  };

  if (isLoading || permLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offboarding</h1>
          <p className="text-slate-500 mt-1">
            {filteredRows.length} offboarding{filteredRows.length !== 1 ? 's' : ''} 
            {viewMode === 'pipeline' ? ' in pipeline' : ' in history'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented control */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('pipeline')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === 'pipeline'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Clock className="h-4 w-4" />
              Pipeline
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded text-xs",
                viewMode === 'pipeline' ? "bg-slate-200 text-slate-700" : "bg-slate-200/50 text-slate-500"
              )}>
                {pipelineCount}
              </span>
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === 'history'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <History className="h-4 w-4" />
              History
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded text-xs",
                viewMode === 'history' ? "bg-slate-200 text-slate-700" : "bg-slate-200/50 text-slate-500"
              )}>
                {historyCount}
              </span>
            </button>
          </div>

          {userIsAdmin && (
            <Button 
              onClick={() => {
                setStartOffboardingEmployee(null);
                setShowStartModal(true);
              }} 
              className="bg-red-600 hover:bg-red-700"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              Start Offboarding
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <OffboardingFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        entityId={entityId}
        onEntityChange={setEntityId}
        exitTypeFilter={exitTypeFilter}
        onExitTypeChange={setExitTypeFilter}
        managerId={managerId}
        onManagerChange={setManagerId}
        departments={departments}
        entities={entities}
        managers={managersWithOffboardings}
        showEntityFilter={entities.length > 1}
        viewMode={viewMode}
      />

      {/* Table */}
      <OffboardingListTable
        rows={filteredRows}
        viewType={viewMode}
        onStartOffboarding={handleStartOffboarding}
        onRefresh={loadData}
        isAdmin={userIsAdmin}
        documentCounts={documentCounts}
      />

      {/* Start Offboarding Wizard */}
      <StartOffboardingWizard
        open={showStartModal}
        onOpenChange={(open) => {
          setShowStartModal(open);
          if (!open) setStartOffboardingEmployee(null);
        }}
        preselectedEmployee={startOffboardingEmployee}
        employees={employees}
        onSuccess={handleStartSuccess}
      />
    </div>
  );
}