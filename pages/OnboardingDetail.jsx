import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  User, 
  Users, 
  Monitor, 
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { getOnboardingProgress, completeTask, getTasksByRole } from '@/components/onboarding/onboardingAutomation';

const OnboardingInstance = base44.entities.OnboardingInstance;
const OnboardingTask = base44.entities.OnboardingTask;
const Employee = base44.entities.Employee;
const OnboardingTemplate = base44.entities.OnboardingTemplate;

const ROLE_CONFIG = {
  HR: { label: 'HR Tasks', icon: Users, color: 'bg-purple-100 text-purple-600' },
  MANAGER: { label: 'Manager Tasks', icon: Briefcase, color: 'bg-blue-100 text-blue-600' },
  IT: { label: 'IT Tasks', icon: Monitor, color: 'bg-orange-100 text-orange-600' },
  EMPLOYEE: { label: 'Employee Tasks', icon: User, color: 'bg-green-100 text-green-600' },
};

export default function OnboardingDetail() {
  const [instance, setInstance] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [template, setTemplate] = useState(null);
  const [tasksByRole, setTasksByRole] = useState({});
  const [progress, setProgress] = useState({ percentage: 0, completed: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const instanceId = urlParams.get('id');

  useEffect(() => {
    if (instanceId) {
      loadData();
    }
  }, [instanceId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const instances = await OnboardingInstance.filter({ id: instanceId });
      if (instances.length === 0) {
        setIsLoading(false);
        return;
      }
      const inst = instances[0];
      setInstance(inst);

      const [employeesData, templatesData, tasksGrouped, progressData] = await Promise.all([
        Employee.filter({ id: inst.employee_id }),
        OnboardingTemplate.filter({ id: inst.template_id }),
        getTasksByRole(instanceId),
        getOnboardingProgress(instanceId),
      ]);

      setEmployee(employeesData[0] || null);
      setTemplate(templatesData[0] || null);
      setTasksByRole(tasksGrouped);
      setProgress(progressData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskToggle = async (task) => {
    if (task.status === 'completed') return;
    
    setUpdatingTaskId(task.id);
    try {
      await completeTask(task.id);
      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const getTaskDueStatus = (dueDate) => {
    const date = new Date(dueDate);
    if (isToday(date)) return 'today';
    if (isPast(date)) return 'overdue';
    return 'upcoming';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Onboarding instance not found</p>
        <Link to={createPageUrl('OnboardingDashboard')}>
          <Button variant="outline" className="mt-4">Back to Onboarding</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={createPageUrl('OnboardingDashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {employee?.first_name} {employee?.last_name}
            </h1>
            <Badge 
              variant="secondary" 
              className={
                instance.status === 'completed' 
                  ? 'bg-green-100 text-green-700' 
                  : instance.status === 'active'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
              }
            >
              {instance.status}
            </Badge>
          </div>
          <p className="text-gray-500">
            {employee?.job_title} • Started {format(new Date(instance.start_date), 'MMMM d, yyyy')}
          </p>
          <p className="text-sm text-gray-400 mt-1">Template: {template?.name}</p>
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-2xl font-bold text-blue-600">{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} className="h-3" />
          <div className="flex justify-between mt-2 text-sm text-gray-500">
            <span>{progress.completed} of {progress.total} tasks completed</span>
            {instance.status === 'completed' && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Onboarding Complete
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tasks by Role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const tasks = tasksByRole[role] || [];
          const Icon = config.icon;
          const completedCount = tasks.filter(t => t.status === 'completed').length;

          return (
            <Card key={role}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{config.label}</h3>
                    <p className="text-sm text-gray-500">
                      {completedCount}/{tasks.length} completed
                    </p>
                  </div>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No tasks</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map(task => {
                      const dueStatus = getTaskDueStatus(task.due_date);
                      const isCompleted = task.status === 'completed';
                      const isUpdating = updatingTaskId === task.id;

                      return (
                        <div 
                          key={task.id} 
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            isCompleted 
                              ? 'bg-gray-50 border-gray-100' 
                              : 'bg-white border-gray-200 hover:border-blue-200'
                          }`}
                        >
                          <div className="pt-0.5">
                            {isUpdating ? (
                              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            ) : (
                              <Checkbox
                                checked={isCompleted}
                                onCheckedChange={() => handleTaskToggle(task)}
                                disabled={isCompleted}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {task.task_name}
                            </p>
                            {task.description && (
                              <p className={`text-sm mt-0.5 ${isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className={`text-xs ${
                                isCompleted 
                                  ? 'text-gray-400' 
                                  : dueStatus === 'overdue' 
                                    ? 'text-red-600' 
                                    : dueStatus === 'today'
                                      ? 'text-orange-600'
                                      : 'text-gray-500'
                              }`}>
                                {isCompleted 
                                  ? `Completed ${task.completed_at ? format(new Date(task.completed_at), 'MMM d') : ''}`
                                  : `Due ${format(new Date(task.due_date), 'MMM d')}`
                                }
                                {!isCompleted && dueStatus === 'overdue' && ' (Overdue)'}
                                {!isCompleted && dueStatus === 'today' && ' (Today)'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}