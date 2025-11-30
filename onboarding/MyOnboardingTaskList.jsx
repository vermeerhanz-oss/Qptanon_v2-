import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { 
  CheckCircle2, Circle, Clock, AlertCircle, ExternalLink, FileText, Loader2, Calendar, Check
} from 'lucide-react';
import { format } from 'date-fns';

const Policy = base44.entities.Policy;
const PolicyVersion = base44.entities.PolicyVersion;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', icon: Circle, className: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', icon: Clock, className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
  blocked: { label: 'Blocked', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
};

export default function MyOnboardingTaskList({ 
  tasks, 
  onCompleteTask, 
  updatingTaskId,
  isOnboardingCompleted,
  employeeId
}) {
  const [policyData, setPolicyData] = useState({});
  const [selectedPolicyTask, setSelectedPolicyTask] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);

  // Load policy data for tasks with policy_id
  useEffect(() => {
    loadPolicyData();
  }, [tasks, employeeId]);

  const loadPolicyData = async () => {
    if (!employeeId) return;
    
    const policyTasks = tasks.filter(t => t.policy_id);
    if (policyTasks.length === 0) return;

    const policyIds = [...new Set(policyTasks.map(t => t.policy_id))];
    
    const [policies, versions, acks] = await Promise.all([
      Policy.list(),
      PolicyVersion.filter({ is_published: true }),
      PolicyAcknowledgement.filter({ employee_id: employeeId }),
    ]);

    const data = {};
    for (const policyId of policyIds) {
      const policy = policies.find(p => p.id === policyId);
      const policyVersions = versions.filter(v => v.policy_id === policyId);
      const latestVersion = policyVersions.sort((a, b) => b.version_number - a.version_number)[0];
      const acknowledgement = latestVersion 
        ? acks.find(a => a.version_id === latestVersion.id)
        : null;

      data[policyId] = {
        policy,
        latestVersion,
        isAcknowledged: !!acknowledgement,
        acknowledgement,
      };
    }
    setPolicyData(data);
  };

  const handleViewPolicy = async (task) => {
    const data = policyData[task.policy_id];
    if (!data?.policy || !data?.latestVersion) return;
    
    setSelectedPolicyTask(task);
    setSelectedPolicy(data.policy);
    setSelectedVersion(data.latestVersion);
  };

  const handleAcknowledgePolicy = async () => {
    if (!selectedPolicyTask || !selectedVersion || !employeeId) return;

    setAcknowledging(true);
    try {
      // Create acknowledgement
      await PolicyAcknowledgement.create({
        policy_id: selectedPolicy.id,
        version_id: selectedVersion.id,
        employee_id: employeeId,
        acknowledged_at: new Date().toISOString(),
        method: 'in_app',
      });

      // Complete the onboarding task
      await onCompleteTask(selectedPolicyTask.id);

      // Refresh policy data
      await loadPolicyData();

      setSelectedPolicyTask(null);
      setSelectedPolicy(null);
      setSelectedVersion(null);
    } catch (error) {
      console.error('Error acknowledging policy:', error);
    } finally {
      setAcknowledging(false);
    }
  };

  // Check if a policy task is already acknowledged (via My Policies or elsewhere)
  const isPolicyTaskAcknowledged = (task) => {
    if (!task.policy_id) return false;
    return policyData[task.policy_id]?.isAcknowledged || false;
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          No tasks assigned to you
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.map(task => {
          const policyAcknowledged = isPolicyTaskAcknowledged(task);
          const effectivelyCompleted = task.status === 'completed' || policyAcknowledged;
          const statusConfig = effectivelyCompleted 
            ? STATUS_CONFIG.completed 
            : (STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started);
          const StatusIcon = statusConfig.icon;
          const isCompleted = effectivelyCompleted;
          const isUpdating = updatingTaskId === task.id;
          const canComplete = !isCompleted && task.status !== 'blocked' && !isOnboardingCompleted;
          const hasPolicyToAcknowledge = task.policy_id && !policyAcknowledged && canComplete;

          return (
            <div 
              key={task.id} 
              className={`p-4 border rounded-lg transition-colors ${
                isCompleted ? 'bg-gray-50 border-gray-200' : 'bg-white hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox / Status */}
                <div className="pt-0.5">
                  {isUpdating ? (
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : canComplete ? (
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => onCompleteTask(task.id)}
                      className="h-5 w-5"
                    />
                  ) : (
                    <StatusIcon className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {task.title}
                      {task.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h4>
                    <Badge className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {task.description && (
                    <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                      {task.description}
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {task.due_date && (
                      <span className={`flex items-center gap-1 text-xs ${
                        isCompleted ? 'text-gray-400' : 
                        new Date(task.due_date) < new Date() ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        <Calendar className="h-3 w-3" />
                        Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}

                    {task.completed_at && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed {format(new Date(task.completed_at), 'MMM d, yyyy')}
                      </span>
                    )}

                    {policyAcknowledged && task.status !== 'completed' && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Acknowledged via My Policies
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {task.link_url && (
                      <a href={task.link_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </Button>
                      </a>
                    )}

                    {/* Policy task with acknowledgement required */}
                    {hasPolicyToAcknowledge && (
                      <Button 
                        size="sm" 
                        onClick={() => handleViewPolicy(task)}
                        className="flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        Review & Acknowledge
                      </Button>
                    )}

                    {/* Policy task already acknowledged - just show view */}
                    {task.policy_id && policyAcknowledged && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewPolicy(task)}
                        className="flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        View Policy
                      </Button>
                    )}

                    {/* Non-policy task completion */}
                    {canComplete && !task.link_url && !task.policy_id && (
                      <Button 
                        size="sm" 
                        onClick={() => onCompleteTask(task.id)}
                        disabled={isUpdating}
                        className="flex items-center gap-1"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Mark Complete
                      </Button>
                    )}
                  </div>

                  {task.blocked_reason && task.status === 'blocked' && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                      Blocked: {task.blocked_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>

    {/* Policy Viewer Sheet */}
    <Sheet open={!!selectedPolicyTask} onOpenChange={(open) => !open && setSelectedPolicyTask(null)}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        {selectedPolicy && selectedVersion && (
          <>
            <SheetHeader>
              <SheetTitle>{selectedPolicy.name}</SheetTitle>
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {selectedPolicy.is_mandatory && (
                  <Badge className="bg-amber-100 text-amber-700">Mandatory</Badge>
                )}
                {selectedPolicy.category && (
                  <Badge variant="outline">{selectedPolicy.category}</Badge>
                )}
                <Badge variant="outline">
                  v{selectedVersion.version_number}
                  {selectedVersion.effective_from && ` · Effective ${selectedVersion.effective_from}`}
                </Badge>
              </div>
            </SheetHeader>

            <div className="py-6 space-y-6">
              {selectedVersion.summary && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600">{selectedVersion.summary}</p>
                </div>
              )}

              {selectedVersion.document_url && (
                <a
                  href={selectedVersion.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  View attached document
                </a>
              )}

              {selectedVersion.content && (
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedVersion.content }} />
                </div>
              )}

              {!selectedVersion.content && !selectedVersion.document_url && (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-10 w-10 mx-auto mb-3" />
                  <p>No content available for this policy version.</p>
                </div>
              )}
            </div>

            <SheetFooter className="gap-2 sm:gap-0 border-t pt-4">
              {policyData[selectedPolicy.id]?.isAcknowledged ? (
                <Button variant="outline" onClick={() => setSelectedPolicyTask(null)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setSelectedPolicyTask(null)}>
                    Close
                  </Button>
                  <Button onClick={handleAcknowledgePolicy} disabled={acknowledging}>
                    {acknowledging ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        I have read and agree
                      </>
                    )}
                  </Button>
                </>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}