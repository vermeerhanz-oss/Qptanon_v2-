import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const EmployeeOnboardingTask = base44.entities.EmployeeOnboardingTask;

export default function ProfileOnboardingSection({ employee }) {
  const [onboarding, setOnboarding] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employee?.id) {
      loadOnboardingData();
    }
  }, [employee?.id]);

  const loadOnboardingData = async () => {
    setIsLoading(true);
    try {
      const onboardings = await EmployeeOnboarding.filter({ employee_id: employee.id });
      if (onboardings.length > 0) {
        // Get the most recent onboarding
        const latestOnboarding = onboardings.sort((a, b) => 
          (b.created_date || '').localeCompare(a.created_date || '')
        )[0];
        setOnboarding(latestOnboarding);

        // Load tasks for this onboarding
        const onboardingTasks = await EmployeeOnboardingTask.filter({ 
          onboarding_id: latestOnboarding.id 
        });
        // Sort by order_index then due_date
        onboardingTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        setTasks(onboardingTasks);
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      not_started: 'bg-gray-100 text-gray-600',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      blocked: 'bg-red-100 text-red-700',
      paused: 'bg-yellow-100 text-yellow-700',
    };
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-600'}>{status?.replace('_', ' ')}</Badge>;
  };

  const getTaskIcon = (status) => {
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'in_progress') return <Clock className="h-4 w-4 text-blue-500" />;
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!onboarding) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Onboarding</h3>
          </div>
          <p className="text-sm text-gray-500">No onboarding record found for this employee.</p>
        </CardContent>
      </Card>
    );
  }

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;

  return (
    <div className="space-y-6">
      {/* Onboarding Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900">Onboarding Status</h3>
            </div>
            {getStatusBadge(onboarding.status)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Start Date</p>
              <p className="font-medium text-gray-900">
                {onboarding.start_date ? format(parseISO(onboarding.start_date), 'dd MMM yyyy') : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Progress</p>
              <p className="font-medium text-gray-900">{completedCount} / {totalCount} tasks</p>
            </div>
            {onboarding.completed_at && (
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="font-medium text-green-600">
                  {format(parseISO(onboarding.completed_at), 'dd MMM yyyy')}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Onboarding Tasks</h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-500">No tasks assigned</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {tasks.map(task => (
                <div key={task.id} className="py-3 flex items-start gap-3">
                  {getTaskIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {task.category && <span>{task.category}</span>}
                      {task.due_date && (
                        <span>Due: {format(parseISO(task.due_date), 'dd MMM')}</span>
                      )}
                      {task.assigned_to_role && (
                        <span className="capitalize">{task.assigned_to_role}</span>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(task.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}