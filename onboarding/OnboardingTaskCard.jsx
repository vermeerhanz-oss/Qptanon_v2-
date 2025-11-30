import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { format, parseISO, isBefore, addDays, startOfToday, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

/**
 * Get the urgency status of a task based on due date
 */
export function getTaskUrgency(task) {
  if (task.status === 'completed') return 'completed';
  if (!task.due_date) return 'upcoming';

  const today = startOfToday();
  const dueDate = parseISO(task.due_date);
  const weekFromNow = addDays(today, 7);

  if (isBefore(dueDate, today)) return 'overdue';
  if (isToday(dueDate)) return 'due_today';
  if (isBefore(dueDate, weekFromNow)) return 'due_soon';
  return 'upcoming';
}

/**
 * Get urgency indicator color
 */
export function getUrgencyColor(urgency) {
  switch (urgency) {
    case 'overdue': return 'bg-red-500';
    case 'due_today': return 'bg-amber-500';
    case 'due_soon': return 'bg-amber-400';
    case 'completed': return 'bg-green-500';
    default: return 'bg-blue-400';
  }
}

/**
 * Task card with urgency indicator
 */
export default function OnboardingTaskCard({ 
  task, 
  onComplete, 
  isUpdating = false,
  showAssignee = false,
  compact = false,
}) {
  const urgency = getTaskUrgency(task);
  const isCompleted = task.status === 'completed';
  const isOverdue = urgency === 'overdue';

  return (
    <div 
      className={cn(
        'relative rounded-lg border transition-colors',
        isCompleted 
          ? 'bg-gray-50 border-gray-200' 
          : isOverdue 
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200 hover:border-indigo-200'
      )}
    >
      {/* Left urgency bar */}
      <div 
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg',
          getUrgencyColor(urgency)
        )}
      />
      
      <div className={cn('pl-4', compact ? 'p-3' : 'p-4')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status icon */}
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            ) : isOverdue ? (
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            ) : (
              <Clock className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn(
                  'font-medium',
                  isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                )}>
                  {task.title}
                  {task.required && <span className="text-red-500 ml-1">*</span>}
                </p>
                {isOverdue && (
                  <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                    Overdue
                  </span>
                )}
              </div>
              
              {!compact && task.description && (
                <p className="text-sm text-gray-500 mt-1">{task.description}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {showAssignee && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {task.assigned_to_role || 'HR'}
                  </Badge>
                )}
                {task.due_date && (
                  <span className={cn(
                    'text-xs flex items-center gap-1',
                    isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                  )}>
                    <Calendar className="h-3 w-3" />
                    {isToday(parseISO(task.due_date)) 
                      ? 'Due today' 
                      : `Due ${format(parseISO(task.due_date), 'MMM d')}`}
                  </span>
                )}
                {task.link_url && (
                  <a 
                    href={task.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open link
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {/* Action button */}
          {!isCompleted && onComplete && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task.id);
              }}
              disabled={isUpdating}
              className="flex-shrink-0"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}