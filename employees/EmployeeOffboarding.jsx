import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Loader2, UserMinus, CheckCircle2, Clock, Ban, AlertTriangle } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';
import { ExitInterviewSection } from '@/components/offboarding/ExitInterviewSection';
import { isAdmin, isManager } from '@/components/utils/permissions';

const OffboardingInstance = base44.entities.OffboardingInstance;
const OffboardingTask = base44.entities.OffboardingTask;
const OffboardingTemplate = base44.entities.OffboardingTemplate;
const OffboardingTemplateTask = base44.entities.OffboardingTemplateTask;
const Employee = base44.entities.Employee;

export function EmployeeOffboarding({ employeeId, employee, user, canStartOffboarding }) {
  const [activeInstance, setActiveInstance] = useState(null);
  const [historicalInstance, setHistoricalInstance] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [instances, allTemplates] = await Promise.all([
        OffboardingInstance.filter({ employee_id: employeeId }),
        OffboardingTemplate.list(),
      ]);

      setTemplates(allTemplates);
      
      // Default template selection
      const standardTemplate = allTemplates.find(t => t.name.toLowerCase().includes('standard'));
      if (standardTemplate) {
        setSelectedTemplate(standardTemplate.id);
      } else if (allTemplates.length > 0) {
        setSelectedTemplate(allTemplates[0].id);
      }

      // Sort instances by created_date descending
      const sortedInstances = instances.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );

      // Active = not_started or in_progress
      const active = sortedInstances.find(i => 
        i.status === 'not_started' || i.status === 'in_progress'
      );
      
      // Historical = most recent completed or cancelled
      const historical = sortedInstances.find(i => 
        i.status === 'completed' || i.status === 'cancelled'
      );

      setActiveInstance(active || null);
      setHistoricalInstance(historical || null);

      // Load tasks for active instance
      if (active) {
        const taskList = await OffboardingTask.filter({ instance_id: active.id });
        setTasks(taskList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error loading offboarding data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOffboarding = async () => {
    if (!selectedTemplate || !endDate) return;

    setIsCreating(true);
    try {
      // Create the offboarding instance
      const newInstance = await OffboardingInstance.create({
        employee_id: employeeId,
        template_id: selectedTemplate,
        status: 'in_progress',
        final_day: endDate,
      });

      // Get template tasks
      const templateTasks = await OffboardingTemplateTask.filter({ template_id: selectedTemplate });

      // Create offboarding tasks from template
      for (const tt of templateTasks) {
        await OffboardingTask.create({
          instance_id: newInstance.id,
          title: tt.title,
          description: tt.description || '',
          assignee_type: tt.assignee_role,
          status: 'not_started',
        });
      }

      // Update employee end date
      await Employee.update(employeeId, { end_date: endDate });

      setShowModal(false);
      setEndDate('');
      await loadData();
    } catch (err) {
      console.error('Error starting offboarding:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleTask = async (task) => {
    setUpdatingTaskId(task.id);
    try {
      const newStatus = task.status === 'done' ? 'not_started' : 'done';
      const updateData = {
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      };

      await OffboardingTask.update(task.id, updateData);

      // Update local state
      const updatedTasks = tasks.map(t => 
        t.id === task.id ? { ...t, ...updateData } : t
      );
      setTasks(updatedTasks);

      // Check if all tasks are done
      const allDone = updatedTasks.every(t => t.status === 'done');
      if (allDone && activeInstance.status !== 'completed') {
        await OffboardingInstance.update(activeInstance.id, { status: 'completed' });
        await Employee.update(employeeId, { status: 'terminated' });
        setActiveInstance({ ...activeInstance, status: 'completed' });
      } else if (!allDone && activeInstance.status === 'completed') {
        await OffboardingInstance.update(activeInstance.id, { status: 'in_progress' });
        setActiveInstance({ ...activeInstance, status: 'in_progress' });
      }
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const roleLabels = {
    hr: 'HR',
    manager: 'Manager',
    it: 'IT',
    employee: 'Employee',
  };

  const roleColors = {
    hr: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    it: 'bg-orange-100 text-orange-700',
    employee: 'bg-green-100 text-green-700',
  };

  const handleCancelOffboarding = async () => {
    setIsCancelling(true);
    try {
      await OffboardingInstance.update(activeInstance.id, {
        status: 'cancelled',
        cancellation_reason: cancellationReason || null,
        cancelled_at: new Date().toISOString(),
      });
      // Reload data to properly update active/historical states
      setShowCancelModal(false);
      setCancellationReason('');
      await loadData();
    } catch (err) {
      console.error('Error cancelling offboarding:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = activeInstance && (activeInstance.status === 'not_started' || activeInstance.status === 'in_progress');
  const canEditExitInterview = isAdmin(user) || isManager(user);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Start Offboarding Modal (shared across states)
  const renderStartModal = () => (
    showModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              {historicalInstance ? 'Start New Offboarding' : 'Start Offboarding'}
            </h2>
            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Offboarding Template
              </label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Final Working Day
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartOffboarding} 
              disabled={!selectedTemplate || !endDate || isCreating}
            >
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start Offboarding
            </Button>
          </div>
        </div>
      </div>
    )
  );

  // No active offboarding - show historical info and start button
  if (!activeInstance) {
    return (
      <div className="space-y-4">
        {/* Show cancelled historical instance info */}
        {historicalInstance?.status === 'cancelled' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Previous Offboarding Cancelled</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Cancelled on {format(new Date(historicalInstance.cancelled_at), 'MMM d, yyyy h:mm a')}
                  </p>
                  {historicalInstance.cancellation_reason && (
                    <p className="text-sm text-yellow-600 mt-2">
                      <span className="font-medium">Reason:</span> {historicalInstance.cancellation_reason}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show completed historical instance info */}
        {historicalInstance?.status === 'completed' && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-800">Previous Offboarding Completed</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Completed on {format(new Date(historicalInstance.updated_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Start offboarding card */}
        <Card>
          <CardContent className="p-8 text-center">
            <UserMinus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {historicalInstance ? 'Start New Offboarding' : 'No Offboarding Started'}
            </h3>
            <p className="text-gray-500 mb-6">
              {historicalInstance 
                ? 'You can start a new offboarding process for this employee.'
                : 'Start the offboarding process when this employee is leaving the company.'
              }
            </p>
            {canStartOffboarding && (
              <Button onClick={() => setShowModal(true)}>
                {historicalInstance ? 'Start New Offboarding' : 'Start Offboarding'}
              </Button>
            )}
          </CardContent>
        </Card>

        {renderStartModal()}
      </div>
    );
  }

  // Active offboarding in progress - show checklist
  const completedCount = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const statusVariant = {
    not_started: 'default',
    in_progress: 'info',
    completed: 'success',
  };

  const statusLabel = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-gray-900">Offboarding Progress</h3>
              <Badge variant={statusVariant[activeInstance.status]}>
                {statusLabel[activeInstance.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {completedCount} of {tasks.length} tasks complete
              </span>
              {canCancel && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Offboarding
                </Button>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {(activeInstance.final_day || employee?.end_date) && (
            <p className="text-sm text-gray-500 mt-2">
              Final working day: {format(new Date(activeInstance.final_day || employee.end_date), 'MMM d, yyyy')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cancel Offboarding Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cancel Offboarding</h2>
                <p className="text-sm text-gray-500">This will stop the offboarding process</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Reason (optional)
              </label>
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancellationReason(''); }}>
                Keep Offboarding
              </Button>
              <Button 
                variant="destructive"
                onClick={handleCancelOffboarding} 
                disabled={isCancelling}
              >
                {isCancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Interview Section - only for managers/admins */}
      {canEditExitInterview && (
        <ExitInterviewSection 
          instance={activeInstance} 
          canEdit={canEditExitInterview}
          onUpdate={(updated) => setActiveInstance(updated)}
        />
      )}

      {/* Task Checklist */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`flex items-start gap-4 p-4 ${task.status === 'done' ? 'bg-gray-50' : ''}`}
              >
                <div className="pt-0.5">
                  {updatingTaskId === task.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  ) : (
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={() => handleToggleTask(task)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[task.assignee_type]}`}>
                      {roleLabels[task.assignee_type]}
                    </span>
                    {task.completed_at && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed {format(new Date(task.completed_at), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {tasks.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No tasks in this offboarding template
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}