import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  ClipboardList, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { format } from 'date-fns';

const HRTask = base44.entities.HRTask;
const OnboardingInstance = base44.entities.OnboardingInstance;
const OffboardingInstance = base44.entities.OffboardingInstance;

export default function ProfileActivitySection({ employee }) {
  const [hrTasks, setHrTasks] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [offboarding, setOffboarding] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, [employee.id]);

  const loadActivity = async () => {
    setIsLoading(true);
    try {
      const [tasks, onboardings, offboardings] = await Promise.all([
        HRTask.filter({ employee_id: employee.id }),
        OnboardingInstance.filter({ employee_id: employee.id }),
        OffboardingInstance.filter({ employee_id: employee.id }),
      ]);

      // Sort tasks by created date
      tasks.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setHrTasks(tasks);

      // Get most recent onboarding/offboarding
      if (onboardings.length > 0) {
        onboardings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setOnboarding(onboardings[0]);
      }
      if (offboardings.length > 0) {
        offboardings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setOffboarding(offboardings[0]);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTaskStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-orange-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      relocation_compliance: 'Relocation',
      entity_transfer: 'Entity Transfer',
      role_change: 'Role Change',
      manager_change: 'Manager Change',
      offboarding: 'Offboarding',
      document_required: 'Document Required',
      compensation_review: 'Compensation',
      other: 'Other',
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lifecycle Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Onboarding */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                onboarding ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <UserPlus className={`h-5 w-5 ${onboarding ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Onboarding</p>
                {onboarding ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={
                      onboarding.status === 'completed' ? 'bg-green-100 text-green-700' :
                      onboarding.status === 'active' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }>
                      {onboarding.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Started {format(new Date(onboarding.start_date), 'dd MMM yyyy')}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No onboarding record</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offboarding */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                offboarding ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                <UserMinus className={`h-5 w-5 ${offboarding ? 'text-orange-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Offboarding</p>
                {offboarding ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={
                      offboarding.status === 'completed' ? 'bg-green-100 text-green-700' :
                      offboarding.status === 'in_progress' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }>
                      {offboarding.status}
                    </Badge>
                    {offboarding.final_day && (
                      <span className="text-xs text-gray-500">
                        Final day: {format(new Date(offboarding.final_day), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No offboarding record</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Employee ID</p>
              <p className="text-gray-900 font-mono text-sm mt-1">{employee.id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">User ID</p>
              <p className="text-gray-900 font-mono text-sm mt-1">{employee.user_id || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-gray-900 text-sm mt-1">
                {employee.created_date ? format(new Date(employee.created_date), 'dd MMM yyyy HH:mm') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Updated</p>
              <p className="text-gray-900 text-sm mt-1">
                {employee.updated_date ? format(new Date(employee.updated_date), 'dd MMM yyyy HH:mm') : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HR Tasks */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            HR Tasks ({hrTasks.length})
          </h2>

          {hrTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No HR tasks for this employee</p>
          ) : (
            <div className="space-y-3">
              {hrTasks.slice(0, 10).map(task => (
                <div 
                  key={task.id} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-white"
                >
                  {getTaskStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <Badge variant="outline">{getCategoryLabel(task.category)}</Badge>
                      <Badge variant="secondary" className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>Created: {format(new Date(task.created_date), 'dd MMM yyyy')}</span>
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {format(new Date(task.due_date), 'dd MMM yyyy')}
                        </span>
                      )}
                      {task.trigger_event && (
                        <span>Trigger: {task.trigger_event}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {hrTasks.length > 10 && (
                <p className="text-sm text-gray-500 text-center">
                  + {hrTasks.length - 10} more tasks
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}