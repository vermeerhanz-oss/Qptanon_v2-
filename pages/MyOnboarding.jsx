import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ClipboardList, Calendar, Sparkles, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, isBefore, addDays, startOfToday, isToday } from 'date-fns';
import { toast } from 'sonner';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { getOnboardingProgress, completeTask } from '@/components/onboarding/onboardingEngine';
import OnboardingTaskCard, { getTaskUrgency } from '@/components/onboarding/OnboardingTaskCard';
import OnboardingProgressRing from '@/components/onboarding/OnboardingProgressRing';

const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const EmployeeOnboardingTask = base44.entities.EmployeeOnboardingTask;
const OnboardingTemplate = base44.entities.OnboardingTemplate;

export default function MyOnboarding() {
  const [userContext, setUserContext] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [template, setTemplate] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState({ percentage: 0, requiredPercentage: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setUserContext(ctx);

      if (!ctx.employee) {
        setIsLoading(false);
        return;
      }

      const onboardings = await EmployeeOnboarding.filter({ employee_id: ctx.employee.id });
      
      if (onboardings.length === 0) {
        setOnboarding(null);
        setIsLoading(false);
        return;
      }

      onboardings.sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return new Date(b.created_date) - new Date(a.created_date);
      });

      const activeOnboarding = onboardings[0];
      setOnboarding(activeOnboarding);

      if (activeOnboarding.template_id) {
        const templates = await OnboardingTemplate.filter({ id: activeOnboarding.template_id });
        if (templates.length > 0) setTemplate(templates[0]);
      }

      const allTasks = await EmployeeOnboardingTask.filter({ onboarding_id: activeOnboarding.id });
      const employeeTasks = allTasks.filter(t => t.assigned_to_role === 'employee');
      employeeTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setTasks(employeeTasks);

      const prog = await getOnboardingProgress(activeOnboarding.id);
      setProgress(prog);
    } catch (error) {
      console.error('Error loading onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    setUpdatingTaskId(taskId);
    try {
      const result = await completeTask(taskId);
      
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'completed', completed_at: new Date().toISOString() }
          : t
      ));

      const prog = await getOnboardingProgress(onboarding.id);
      setProgress(prog);

      toast.success('Task marked complete.');

      if (result.onboardingCompleted) {
        setOnboarding(prev => ({ ...prev, status: 'completed', completed_at: new Date().toISOString() }));
        toast.success('Congratulations! You\'ve completed your onboarding.');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to update task.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Group tasks by urgency
  const groupTasks = (taskList) => {
    const groups = { overdue: [], due_soon: [], upcoming: [], completed: [] };

    taskList.forEach(task => {
      const urgency = getTaskUrgency(task);
      if (urgency === 'completed') {
        groups.completed.push(task);
      } else if (urgency === 'overdue') {
        groups.overdue.push(task);
      } else if (urgency === 'due_today' || urgency === 'due_soon') {
        groups.due_soon.push(task);
      } else {
        groups.upcoming.push(task);
      }
    });

    return groups;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No onboarding assigned</h2>
            <p className="text-gray-500">
              Your onboarding will appear here once your manager or HR sets it up.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = onboarding.status === 'completed';
  const grouped = groupTasks(tasks);
  const overdueCount = grouped.overdue.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header with Progress Ring */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <OnboardingProgressRing percentage={progress.requiredPercentage} size={64} strokeWidth={5} />
              <div>
                <CardTitle className="flex items-center gap-2">
                  {isCompleted ? (
                    <Sparkles className="h-5 w-5 text-green-600" />
                  ) : (
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                  )}
                  Your Onboarding
                </CardTitle>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {template && <span>{template.name}</span>}
                  {onboarding.start_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Started {format(parseISO(onboarding.start_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Badge className={isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
              {isCompleted ? 'Completed' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Overall progress</span>
              <span className="font-medium">{progress.requiredCompleted} of {progress.requiredTotal} tasks</span>
            </div>
            <Progress value={progress.requiredPercentage} className="h-2" />
            {overdueCount > 0 && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} overdue {overdueCount === 1 ? 'task' : 'tasks'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Tasks */}
      {grouped.overdue.length > 0 && (
        <TaskSection
          title="Overdue"
          icon={AlertTriangle}
          iconColor="text-red-500"
          badgeClass="bg-red-100 text-red-700"
          tasks={grouped.overdue}
          onCompleteTask={handleCompleteTask}
          updatingTaskId={updatingTaskId}
        />
      )}

      {/* Due Soon */}
      {grouped.due_soon.length > 0 && (
        <TaskSection
          title="Due Soon"
          icon={Clock}
          iconColor="text-amber-500"
          badgeClass="bg-amber-100 text-amber-700"
          tasks={grouped.due_soon}
          onCompleteTask={handleCompleteTask}
          updatingTaskId={updatingTaskId}
        />
      )}

      {/* Upcoming */}
      {grouped.upcoming.length > 0 && (
        <TaskSection
          title="Upcoming"
          icon={Calendar}
          iconColor="text-blue-500"
          badgeClass="bg-blue-100 text-blue-700"
          tasks={grouped.upcoming}
          onCompleteTask={handleCompleteTask}
          updatingTaskId={updatingTaskId}
        />
      )}

      {/* All done message */}
      {grouped.overdue.length === 0 && grouped.due_soon.length === 0 && 
       grouped.upcoming.length === 0 && grouped.completed.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-green-800">All tasks completed!</h3>
            <p className="text-green-600 text-sm mt-1">You're all done with your onboarding tasks.</p>
          </CardContent>
        </Card>
      )}

      {/* Completed Tasks */}
      {grouped.completed.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <CardTitle className="text-lg">Completed Tasks</CardTitle>
                <Badge className="bg-green-100 text-green-700">{grouped.completed.length}</Badge>
              </div>
              {showCompleted ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </CardHeader>
          {showCompleted && (
            <CardContent className="pt-0 space-y-2">
              {grouped.completed.map(task => (
                <div key={task.id} className="p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-500 line-through">{task.title}</p>
                      {task.completed_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Completed {format(parseISO(task.completed_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function TaskSection({ title, icon: Icon, iconColor, badgeClass, tasks, onCompleteTask, updatingTaskId }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge className={badgeClass}>{tasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {tasks.map(task => (
          <OnboardingTaskCard
            key={task.id}
            task={task}
            onComplete={onCompleteTask}
            isUpdating={updatingTaskId === task.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}