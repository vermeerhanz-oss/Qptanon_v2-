import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle2, Circle, Clock, AlertCircle, User, Users, Briefcase, Monitor, DollarSign,
  Loader2, Calendar, MoreHorizontal, UserPlus, Lock, Unlock, ExternalLink, Mail
} from 'lucide-react';
import TaskDocuments from '@/components/documents/TaskDocuments';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { getDisplayName } from '@/components/utils/displayName';
import { completeOffboardingTask } from './offboardingEngine';

const EmployeeOffboardingTask = base44.entities.EmployeeOffboardingTask;

const ROLE_ICONS = {
  employee: User,
  manager: Users,
  hr: Briefcase,
  it: Monitor,
  finance: DollarSign,
};

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', icon: Circle, className: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', icon: Clock, className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
  blocked: { label: 'Blocked', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
};

const GOOGLE_SYNC_STATUS = {
  not_linked: { label: 'Not linked', className: 'bg-gray-100 text-gray-600' },
  provisioned: { label: 'Active', className: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspended', className: 'bg-yellow-100 text-yellow-700' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700' },
};

function GoogleSyncStatus({ employee }) {
  const status = employee.google_sync_status || 'not_linked';
  const config = GOOGLE_SYNC_STATUS[status] || GOOGLE_SYNC_STATUS.not_linked;
  
  return (
    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2 text-xs">
        <Mail className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-slate-600 font-medium">Google Workspace:</span>
        <Badge className={`${config.className} text-xs`}>{config.label}</Badge>
      </div>
      {employee.google_primary_email && (
        <p className="text-xs text-slate-500 mt-1 ml-5">
          {employee.google_primary_email}
        </p>
      )}
      {employee.google_last_error && status === 'error' && (
        <p className="text-xs text-red-600 mt-1 ml-5">
          {employee.google_last_error}
        </p>
      )}
    </div>
  );
}

export default function OffboardingTaskGroup({ 
  title, 
  tasks, 
  roleKey, 
  employees, 
  onTaskUpdate,
  isOffboardingCompleted,
  ownerEmployeeId,
  ownerEmployee,
  currentUser,
  currentEmployee,
  isAdmin
}) {
  const [updatingId, setUpdatingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [blockDialog, setBlockDialog] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  const RoleIcon = ROLE_ICONS[roleKey] || User;

  // Determine if current user can upload documents for a task
  const canUploadForTask = (task) => {
    // If task assigned to employee role, employee can upload their own docs
    if (task.assigned_to_role === 'employee') {
      return currentEmployee?.id === ownerEmployeeId || isAdmin;
    }
    // For manager/hr/it/finance roles, only admins (in admin mode) can upload
    return isAdmin;
  };

  const handleComplete = async (taskId) => {
    setUpdatingId(taskId);
    try {
      await completeOffboardingTask(taskId);
      onTaskUpdate();
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkInProgress = async (taskId) => {
    setUpdatingId(taskId);
    try {
      await EmployeeOffboardingTask.update(taskId, { status: 'in_progress' });
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBlock = async () => {
    if (!blockDialog) return;
    setUpdatingId(blockDialog.id);
    try {
      await EmployeeOffboardingTask.update(blockDialog.id, {
        status: 'blocked',
        blocked_reason: blockReason,
      });
      setBlockDialog(null);
      setBlockReason('');
      onTaskUpdate();
    } catch (error) {
      console.error('Error blocking task:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnblock = async (taskId) => {
    setUpdatingId(taskId);
    try {
      await EmployeeOffboardingTask.update(taskId, {
        status: 'not_started',
        blocked_reason: null,
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Error unblocking task:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    setUpdatingId(editingTask.id);
    try {
      await EmployeeOffboardingTask.update(editingTask.id, {
        due_date: editingTask.due_date || null,
        assigned_to_employee_id: editingTask.assigned_to_employee_id || null,
      });
      setEditingTask(null);
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (tasks.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RoleIcon className="h-5 w-5 text-red-600" />
          {title}
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map(task => {
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
            const StatusIcon = statusConfig.icon;
            const isCompleted = task.status === 'completed';
            const isBlocked = task.status === 'blocked';
            const isUpdating = updatingId === task.id;
            const assignee = task.assigned_to_employee_id 
              ? employees.find(e => e.id === task.assigned_to_employee_id)
              : null;

            return (
              <div 
                key={task.id} 
                className={`p-3 border rounded-lg ${isCompleted ? 'bg-gray-50' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="pt-0.5">
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                      ) : (
                        <StatusIcon className={`h-5 w-5 ${
                          isCompleted ? 'text-green-600' : 
                          isBlocked ? 'text-red-500' : 'text-gray-400'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : ''}`}>
                          {task.title}
                        </span>
                        {task.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                        <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        {assignee && (
                          <span className="flex items-center gap-1">
                            <UserPlus className="h-3 w-3" />
                            {getDisplayName(assignee)}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        {task.completed_at && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed {format(new Date(task.completed_at), 'MMM d')}
                          </span>
                        )}
                        {task.link_url && (
                          <a 
                            href={task.link_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open Link
                          </a>
                        )}
                      </div>

                      {isBlocked && task.blocked_reason && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                          {task.blocked_reason}
                        </div>
                      )}

                      {/* Google Account Status for GOOGLE_ACCOUNT_SUSPEND tasks */}
                      {task.system_code === 'GOOGLE_ACCOUNT_SUSPEND' && ownerEmployee && (
                        <GoogleSyncStatus employee={ownerEmployee} />
                      )}

                      {/* Task Documents */}
                      <div className="mt-2">
                        <TaskDocuments
                          taskId={task.id}
                          taskType="offboarding"
                          ownerEmployeeId={ownerEmployeeId}
                          assignedToRole={task.assigned_to_role}
                          canUpload={canUploadForTask(task)}
                          currentUser={currentUser}
                          onDocumentAdded={onTaskUpdate}
                        />
                      </div>
                    </div>
                  </div>

                  {!isOffboardingCompleted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isCompleted && !isBlocked && (
                          <DropdownMenuItem onClick={() => handleComplete(task.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        {task.status === 'not_started' && (
                          <DropdownMenuItem onClick={() => handleMarkInProgress(task.id)}>
                            <Clock className="h-4 w-4 mr-2" />
                            Mark In Progress
                          </DropdownMenuItem>
                        )}
                        {!isCompleted && !isBlocked && (
                          <DropdownMenuItem onClick={() => setBlockDialog(task)}>
                            <Lock className="h-4 w-4 mr-2" />
                            Block
                          </DropdownMenuItem>
                        )}
                        {isBlocked && (
                          <DropdownMenuItem onClick={() => handleUnblock(task.id)}>
                            <Unlock className="h-4 w-4 mr-2" />
                            Unblock
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingTask({ ...task })}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Edit Due Date / Reassign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Block Dialog */}
      <Dialog open={!!blockDialog} onOpenChange={() => setBlockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Why is this task blocked?
            </p>
            <Textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)}>Cancel</Button>
            <Button onClick={handleBlock} disabled={!blockReason.trim()}>Block Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editingTask.due_date || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Assign to Employee</Label>
                <Select
                  value={editingTask.assigned_to_employee_id || ''}
                  onValueChange={(v) => setEditingTask({ ...editingTask, assigned_to_employee_id: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Unassigned (role-based)</SelectItem>
                    {employees.filter(e => e.status === 'active').map(e => (
                      <SelectItem key={e.id} value={e.id}>{getDisplayName(e)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}