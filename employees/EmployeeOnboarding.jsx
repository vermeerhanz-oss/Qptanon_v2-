import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Loader2, UserPlus, CheckCircle2, Ban, AlertTriangle } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';
import { isAdmin } from '@/components/utils/permissions';

const OnboardingInstance = base44.entities.OnboardingInstance;
const OnboardingTask = base44.entities.OnboardingTask;
const OnboardingTemplate = base44.entities.OnboardingTemplate;
const OnboardingTemplateTask = base44.entities.OnboardingTemplateTask;

export function EmployeeOnboarding({ employeeId, employee, user, currentEmployee, canCreateOnboarding }) {
  const [activeInstance, setActiveInstance] = useState(null);
  const [historicalInstance, setHistoricalInstance] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
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
        OnboardingInstance.filter({ employee_id: employeeId }),
        OnboardingTemplate.list(),
      ]);

      const activeTemplates = allTemplates.filter(t => t.active !== false);
      setTemplates(activeTemplates);
      
      const standardTemplate = activeTemplates.find(t => t.name.toLowerCase().includes('standard'));
      if (standardTemplate) {
        setSelectedTemplate(standardTemplate.id);
      } else if (activeTemplates.length > 0) {
        setSelectedTemplate(activeTemplates[0].id);
      }

      // Default start date to employee's start_date
      if (employee?.start_date) {
        setStartDate(employee.start_date);
      }

      const sortedInstances = instances.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );

      const active = sortedInstances.find(i => 
        i.status === 'not_started' || i.status === 'in_progress'
      );
      
      const historical = sortedInstances.find(i => 
        i.status === 'completed' || i.status === 'cancelled'
      );

      setActiveInstance(active || null);
      setHistoricalInstance(historical || null);

      if (active) {
        const taskList = await OnboardingTask.filter({ instance_id: active.id });
        setTasks(taskList);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error loading onboarding data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    try {
      const newInstance = await OnboardingInstance.create({
        employee_id: employeeId,
        template_id: selectedTemplate,
        status: 'in_progress',
        start_date: startDate || null,
        due_date: dueDate || null,
      });

      const templateTasks = await OnboardingTemplateTask.filter({ template_id: selectedTemplate });

      for (const tt of templateTasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
        let assigneeEmployeeId = null;
        if (tt.assignee_role === 'manager' && employee.manager_id) {
          assigneeEmployeeId = employee.manager_id;
        } else if (tt.assignee_role === 'employee') {
          assigneeEmployeeId = employeeId;
        }

        await OnboardingTask.create({
          instance_id: newInstance.id,
          title: tt.title,
          description: tt.description || '',
          assignee_type: tt.assignee_role,
          assignee_employee_id: assigneeEmployeeId,
          status: 'not_started',
        });
      }

      setShowModal(false);
      setStartDate('');
      setDueDate('');
      await loadData();
    } catch (err) {
      console.error('Error starting onboarding:', err);
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

      await OnboardingTask.update(task.id, updateData);

      const updatedTasks = tasks.map(t => 
        t.id === task.id ? { ...t, ...updateData } : t
      );
      setTasks(updatedTasks);

      const allDone = updatedTasks.every(t => t.status === 'done');
      if (allDone && activeInstance.status !== 'completed') {
        await OnboardingInstance.update(activeInstance.id, { status: 'completed' });
        setActiveInstance({ ...activeInstance, status: 'completed' });
      } else if (!allDone && activeInstance.status === 'completed') {
        await OnboardingInstance.update(activeInstance.id, { status: 'in_progress' });
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

  const handleCancelOnboarding = async () => {
    setIsCancelling(true);
    try {
      await OnboardingInstance.update(activeInstance.id, {
        status: 'cancelled',
        cancellation_reason: cancellationReason || null,
        cancelled_at: new Date().toISOString(),
      });
      setShowCancelModal(false);
      setCancellationReason('');
      await loadData();
    } catch (err) {
      console.error('Error cancelling onboarding:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = activeInstance && (activeInstance.status === 'not_started' || activeInstance.status === 'in_progress');

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const renderStartModal = () => (
    showModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              {historicalInstance ? 'Start New Onboarding' : 'Start Onboarding'}
            </h2>
            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Onboarding Template
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
                Start Date (optional)
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (optional)
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartOnboarding} 
              disabled={!selectedTemplate || isCreating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start Onboarding
            </Button>
          </div>
        </div>
      </div>
    )
  );

  if (!activeInstance) {
    return (
      <div className="space-y-4">
        {historicalInstance?.status === 'cancelled' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Previous Onboarding Cancelled</h3>
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

        {historicalInstance?.status === 'completed' && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-800">Onboarding Completed</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Completed on {format(new Date(historicalInstance.updated_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-8 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {historicalInstance ? 'Start New Onboarding' : 'No Onboarding Started'}
            </h3>
            <p className="text-gray-500 mb-6">
              {historicalInstance 
                ? 'You can start a new onboarding process for this employee.'
                : 'Start the onboarding process to help this employee get set up.'
              }
            </p>
            {canCreateOnboarding && (
              <Button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-700">
                {historicalInstance ? 'Start New Onboarding' : 'Start Onboarding'}
              </Button>
            )}
          </CardContent>
        </Card>

        {renderStartModal()}
      </div>
    );
  }

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
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-gray-900">Onboarding Progress</h3>
              <Badge variant={statusVariant[activeInstance.status]}>
                {statusLabel[activeInstance.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {completedCount} of {tasks.length} tasks complete
              </span>
              {canCancel && isAdmin(user) && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowCancelModal(true)}
                >
                  Cancel Onboarding
                </Button>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            {activeInstance.start_date && (
              <span>Start: {format(new Date(activeInstance.start_date), 'MMM d, yyyy')}</span>
            )}
            {activeInstance.due_date && (
              <span>Due: {format(new Date(activeInstance.due_date), 'MMM d, yyyy')}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cancel Onboarding</h2>
                <p className="text-sm text-gray-500">This will stop the onboarding process</p>
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
                Keep Onboarding
              </Button>
              <Button 
                variant="destructive"
                onClick={handleCancelOnboarding} 
                disabled={isCancelling}
              >
                {isCancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

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
              No tasks in this onboarding template
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}