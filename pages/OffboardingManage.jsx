import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, ShieldAlert, ArrowLeft, User, Calendar, Building2, 
  CheckCircle2, Pause, Play, Plus, Users, XCircle, UserMinus, Mail, Briefcase
} from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { getOffboardingProgress, getOffboardingTasksByRole, startOffboarding, pauseOffboarding, cancelOffboarding, completeOffboardingTask } from '@/components/offboarding/offboardingEngine';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import OffboardingTaskGroup from '@/components/offboarding/OffboardingTaskGroup';
import AddOffboardingTaskDialog from '@/components/offboarding/AddOffboardingTaskDialog';
import CompleteOffboardingDialog from '@/components/offboarding/CompleteOffboardingDialog';
import CancelOffboardingDialog from '@/components/offboarding/CancelOffboardingDialog';
import FinalLeaveSnapshot from '@/components/offboarding/FinalLeaveSnapshot';
import SystemAccessSection from '@/components/offboarding/SystemAccessSection';
import GoogleAccountStatusCard from '@/components/google/GoogleAccountStatusCard';

const EmployeeOffboarding = base44.entities.EmployeeOffboarding;
const EmployeeOffboardingTask = base44.entities.EmployeeOffboardingTask;
const OffboardingTemplate = base44.entities.OffboardingTemplate;
const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;
const Department = base44.entities.Department;

const STATUS_BADGES = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
};

const EXIT_TYPE_LABELS = {
  voluntary: 'Voluntary',
  involuntary: 'Involuntary',
  redundancy: 'Redundancy',
  other: 'Other',
};

export default function OffboardingManage() {
  const [userContext, setUserContext] = useState(null);
  const [offboarding, setOffboarding] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [manager, setManager] = useState(null);
  const [template, setTemplate] = useState(null);
  const [entity, setEntity] = useState(null);
  const [department, setDepartment] = useState(null);
  const [tasksByRole, setTasksByRole] = useState({});
  const [allEmployees, setAllEmployees] = useState([]);
  const [progress, setProgress] = useState({ percentage: 0, requiredPercentage: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const offboardingId = urlParams.get('id');

  const { isAllowed, isLoading: permLoading } = useRequirePermission(userContext, 'canManageOffboarding');

  useEffect(() => {
    if (offboardingId) loadData();
  }, [offboardingId]);

  const loadData = async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setUserContext(ctx);

      const [offboardings, emps, ents, depts] = await Promise.all([
        EmployeeOffboarding.filter({ id: offboardingId }),
        Employee.list(),
        CompanyEntity.list(),
        Department.list(),
      ]);

      if (offboardings.length === 0) {
        setIsLoading(false);
        return;
      }

      const ob = offboardings[0];
      setOffboarding(ob);
      setAllEmployees(emps);

      // Check permissions - allow if general permission or if they're the manager
      const canAccess = ctx.permissions?.canManageOffboarding || 
        (ob.manager_id === ctx.employee?.id && ctx.actingMode === 'admin');
      
      if (!canAccess) {
        setIsLoading(false);
        return;
      }

      // Load related data
      const emp = emps.find(e => e.id === ob.employee_id);
      setEmployee(emp);
      setManager(emps.find(e => e.id === ob.manager_id));
      setEntity(ents.find(e => e.id === ob.entity_id));
      setDepartment(depts.find(d => d.id === ob.department));

      if (ob.template_id) {
        const templates = await OffboardingTemplate.filter({ id: ob.template_id });
        if (templates.length > 0) setTemplate(templates[0]);
      }

      // Load tasks and progress
      await refreshTasks(ob.id);
    } catch (error) {
      console.error('Error loading offboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTasks = async (id) => {
    const tasks = await getOffboardingTasksByRole(id);
    setTasksByRole(tasks);
    const prog = await getOffboardingProgress(id);
    setProgress(prog);
  };

  const handleStartResume = async () => {
    setIsProcessing(true);
    try {
      await startOffboarding(offboarding.id);
      setOffboarding(prev => ({ ...prev, status: 'in_progress' }));
    } catch (error) {
      console.error('Error starting offboarding:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePause = async () => {
    setIsProcessing(true);
    try {
      await pauseOffboarding(offboarding.id);
      setOffboarding(prev => ({ ...prev, status: 'draft' }));
    } catch (error) {
      console.error('Error pausing offboarding:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      await cancelOffboarding(offboarding.id);
      setOffboarding(prev => ({ ...prev, status: 'cancelled' }));
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Error cancelling offboarding:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTaskUpdate = async () => {
    await refreshTasks(offboarding.id);
    // Refresh offboarding status
    const obs = await EmployeeOffboarding.filter({ id: offboarding.id });
    if (obs.length > 0) setOffboarding(obs[0]);
  };

  const handleAddTask = async (taskData) => {
    await EmployeeOffboardingTask.create({
      offboarding_id: offboarding.id,
      ...taskData,
    });
    setShowAddTask(false);
    await refreshTasks(offboarding.id);
  };

  const handleForceComplete = async () => {
    setIsProcessing(true);
    try {
      // Complete all incomplete required tasks
      const allTasks = [...(tasksByRole.employee || []), ...(tasksByRole.manager || []), 
                        ...(tasksByRole.hr || []), ...(tasksByRole.it || []), ...(tasksByRole.finance || [])];
      const incompleteTasks = allTasks.filter(t => t.required && t.status !== 'completed');
      
      await Promise.all(incompleteTasks.map(t => 
        EmployeeOffboardingTask.update(t.id, { 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
      ));

      // Complete offboarding
      await EmployeeOffboarding.update(offboarding.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // Update employee status
      if (employee) {
        await Employee.update(employee.id, { status: 'terminated' });
      }

      setShowCompleteDialog(false);
      await loadData();
    } catch (error) {
      console.error('Error completing offboarding:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!offboarding) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-600 p-4 rounded-lg">
          Offboarding not found
        </div>
      </div>
    );
  }

  // Allow access if general permission OR if they're the assigned manager
  const canAccess = isAllowed || 
    (offboarding.manager_id === userContext?.employee?.id && userContext?.actingMode === 'admin');

  if (!canAccess) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-600 p-4 rounded-lg flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          You don't have permission to manage this offboarding.
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_BADGES[offboarding.status] || STATUS_BADGES.draft;
  const isCompleted = offboarding.status === 'completed';
  const isCancelled = offboarding.status === 'cancelled';
  const isInProgress = offboarding.status === 'in_progress';
  const isEditable = !isCompleted && !isCancelled;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to={createPageUrl('Offboarding')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Offboarding
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-lg font-medium">
            {employee ? getInitials(employee) : '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee ? getDisplayName(employee) : 'Unknown Employee'}
            </h1>
            <p className="text-gray-500">{employee?.job_title || 'Employee'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusConfig.className} text-sm px-3 py-1`}>
            {statusConfig.label}
          </Badge>
          <Badge variant="outline">
            {EXIT_TYPE_LABELS[offboarding.exit_type] || offboarding.exit_type}
          </Badge>
        </div>
      </div>

      {/* Info & Actions Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Last Day</p>
                <p className="font-medium">{offboarding.last_day}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Manager</p>
                <p className="font-medium">{manager ? getDisplayName(manager) : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Department</p>
                <p className="font-medium">{department?.name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Entity</p>
                <p className="font-medium">{entity?.name || '-'}</p>
              </div>
            </div>
          </div>

          {/* Employee details row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-sm truncate">{employee?.email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Job Title</p>
                <p className="font-medium text-sm">{employee?.job_title || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Template</p>
                <p className="font-medium text-sm">{template?.name || 'Manual'}</p>
              </div>
            </div>
            {offboarding.completed_at && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="font-medium text-sm">{new Date(offboarding.completed_at).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>

          {offboarding.reason && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm">{offboarding.reason}</p>
            </div>
          )}

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{progress.requiredPercentage}%</span>
            </div>
            <Progress value={progress.requiredPercentage} className="h-2" />
            <p className="text-xs text-gray-400 mt-1">
              {progress.requiredCompleted} of {progress.requiredTotal} required tasks completed
            </p>
            {progress.requiredPercentage === 100 && offboarding.status !== 'completed' && (
              <div className="mt-2 p-2 bg-green-50 rounded-lg flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                All required tasks complete. Ready to finalize offboarding.
              </div>
            )}
          </div>

          {/* Actions */}
          {isEditable && (
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {!isInProgress && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleStartResume}
                  disabled={isProcessing}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </Button>
              )}
              {isInProgress && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePause}
                  disabled={isProcessing}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddTask(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowCancelDialog(true)}
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={() => setShowCompleteDialog(true)}
                className="bg-green-600 hover:bg-green-700 ml-auto"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete Offboarding
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Account Status */}
      {(() => {
        const allTasks = [...(tasksByRole.employee || []), ...(tasksByRole.manager || []), ...(tasksByRole.hr || []), ...(tasksByRole.it || []), ...(tasksByRole.finance || [])];
        const googleTask = allTasks.find(t => t.system_code === 'GOOGLE_ACCOUNT_SUSPEND');
        if (googleTask || employee?.google_user_id) {
          return (
            <GoogleAccountStatusCard 
              employee={employee}
              variant="offboarding"
              hasGoogleTask={!!googleTask}
              taskStatus={googleTask?.status || 'not_started'}
            />
          );
        }
        return null;
      })()}

      {/* Leave Snapshot & System Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinalLeaveSnapshot 
          employeeId={employee?.id} 
          asOfDate={offboarding.last_day}
        />
        <SystemAccessSection itTasks={tasksByRole.it || []} />
      </div>

      {/* Task Groups */}
      <OffboardingTaskGroup
        title="Employee Tasks"
        tasks={tasksByRole.employee || []}
        roleKey="employee"
        employees={allEmployees}
        onTaskUpdate={handleTaskUpdate}
        isOffboardingCompleted={!isEditable}
        ownerEmployeeId={employee?.id}
        ownerEmployee={employee}
        currentUser={userContext?.user}
        currentEmployee={userContext?.employee}
        isAdmin={userContext?.isAdmin && userContext?.actingMode === 'admin'}
      />
      <OffboardingTaskGroup
        title="Manager Tasks"
        tasks={tasksByRole.manager || []}
        roleKey="manager"
        employees={allEmployees}
        onTaskUpdate={handleTaskUpdate}
        isOffboardingCompleted={!isEditable}
        ownerEmployeeId={employee?.id}
        ownerEmployee={employee}
        currentUser={userContext?.user}
        currentEmployee={userContext?.employee}
        isAdmin={userContext?.isAdmin && userContext?.actingMode === 'admin'}
      />
      <OffboardingTaskGroup
        title="HR Tasks"
        tasks={tasksByRole.hr || []}
        roleKey="hr"
        employees={allEmployees}
        onTaskUpdate={handleTaskUpdate}
        isOffboardingCompleted={!isEditable}
        ownerEmployeeId={employee?.id}
        ownerEmployee={employee}
        currentUser={userContext?.user}
        currentEmployee={userContext?.employee}
        isAdmin={userContext?.isAdmin && userContext?.actingMode === 'admin'}
      />
      <OffboardingTaskGroup
        title="IT Tasks"
        tasks={tasksByRole.it || []}
        roleKey="it"
        employees={allEmployees}
        onTaskUpdate={handleTaskUpdate}
        isOffboardingCompleted={!isEditable}
        ownerEmployeeId={employee?.id}
        ownerEmployee={employee}
        currentUser={userContext?.user}
        currentEmployee={userContext?.employee}
        isAdmin={userContext?.isAdmin && userContext?.actingMode === 'admin'}
      />
      <OffboardingTaskGroup
        title="Finance Tasks"
        tasks={tasksByRole.finance || []}
        roleKey="finance"
        employees={allEmployees}
        onTaskUpdate={handleTaskUpdate}
        isOffboardingCompleted={!isEditable}
        ownerEmployeeId={employee?.id}
        ownerEmployee={employee}
        currentUser={userContext?.user}
        currentEmployee={userContext?.employee}
        isAdmin={userContext?.isAdmin && userContext?.actingMode === 'admin'}
      />

      {/* Dialogs */}
      <AddOffboardingTaskDialog
        open={showAddTask}
        onOpenChange={setShowAddTask}
        onSubmit={handleAddTask}
        employees={allEmployees}
      />
      <CompleteOffboardingDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        onConfirm={handleForceComplete}
        isProcessing={isProcessing}
        incompleteTasks={[...(tasksByRole.employee || []), ...(tasksByRole.manager || []), 
                         ...(tasksByRole.hr || []), ...(tasksByRole.it || []), ...(tasksByRole.finance || [])]
          .filter(t => t.required && t.status !== 'completed').length}
      />
      <CancelOffboardingDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancel}
        isProcessing={isProcessing}
        employeeName={employee ? getDisplayName(employee) : ''}
      />
    </div>
  );
}