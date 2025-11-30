import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Eye, XCircle, CheckCircle2, MoreHorizontal, Loader2, ExternalLink, Download
} from 'lucide-react';
import { exportToCsv } from '@/components/utils/exportCsv';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import CancelOffboardingDialog from './CancelOffboardingDialog';
import CompleteOffboardingDialog from './CompleteOffboardingDialog';
import { cancelOffboarding } from './offboardingEngine';

const EmployeeOffboarding = base44.entities.EmployeeOffboarding;
const EmployeeOffboardingTask = base44.entities.EmployeeOffboardingTask;
const Employee = base44.entities.Employee;
const Document = base44.entities.Document;

const STATUS_CONFIG = {
  draft: { className: 'bg-slate-100 text-slate-700', label: 'Draft' },
  scheduled: { className: 'bg-yellow-100 text-yellow-700', label: 'Scheduled' },
  in_progress: { className: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  completed: { className: 'bg-green-100 text-green-700', label: 'Completed' },
  cancelled: { className: 'bg-gray-100 text-gray-500', label: 'Cancelled' },
};

const EXIT_TYPE_LABELS = {
  voluntary: 'Voluntary',
  involuntary: 'Involuntary',
  redundancy: 'Redundancy',
  other: 'Other',
};

export default function OffboardingListTable({
  rows, // Array of { offboarding, employee, department, entity, location, manager, progress }
  viewType, // 'pipeline' | 'history'
  onStartOffboarding,
  onRefresh,
  isAdmin,
  documentCounts = {}, // Map of offboarding_id => doc count
}) {
  const [cancelDialog, setCancelDialog] = useState(null);
  const [completeDialog, setCompleteDialog] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // CSV Export
  const handleExportCSV = () => {
    const columns = [
      { key: 'employee_name', label: 'employee_name' },
      { key: 'job_title', label: 'job_title' },
      { key: 'last_day', label: 'last_day' },
      { key: 'exit_type', label: 'exit_type' },
      { key: 'status', label: 'status' },
      { key: 'progress_percent', label: 'progress_percent' },
      { key: 'manager', label: 'manager' },
      { key: 'entity', label: 'entity' },
      { key: 'department', label: 'department' },
      { key: 'offboarding_documents', label: 'offboarding_documents' },
    ];

    const csvRows = rows.map(row => {
      const { offboarding, employee, department, entity, manager, progress } = row;
      const progressPercent = progress.requiredTotal > 0 
        ? Math.round((progress.requiredCompleted / progress.requiredTotal) * 100) 
        : 100;
      
      return {
        employee_name: employee ? getDisplayName(employee) : 'Unknown',
        job_title: employee?.job_title || '',
        last_day: offboarding.last_day || '',
        exit_type: EXIT_TYPE_LABELS[offboarding.exit_type] || offboarding.exit_type || '',
        status: STATUS_CONFIG[offboarding.status]?.label || offboarding.status || '',
        progress_percent: progressPercent,
        manager: manager ? getDisplayName(manager) : '',
        entity: entity?.name || '',
        department: department?.name || '',
        offboarding_documents: documentCounts[offboarding.id] || 0,
      };
    });

    exportToCsv({ filename: 'offboarding-list', columns, rows: csvRows });
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const handleCancel = async () => {
    if (!cancelDialog) return;
    setIsProcessing(true);
    try {
      await cancelOffboarding(cancelDialog.offboarding.id);
      setCancelDialog(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error cancelling:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!completeDialog) return;
    setIsProcessing(true);
    try {
      const ob = completeDialog.offboarding;
      
      // Complete all incomplete required tasks
      const tasks = await EmployeeOffboardingTask.filter({ offboarding_id: ob.id });
      const incompleteTasks = tasks.filter(t => t.required && t.status !== 'completed');
      
      await Promise.all(incompleteTasks.map(t => 
        EmployeeOffboardingTask.update(t.id, { 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
      ));

      // Complete offboarding
      await EmployeeOffboarding.update(ob.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // Update employee status
      await Employee.update(ob.employee_id, { status: 'terminated' });

      setCompleteDialog(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error completing:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <p className="text-slate-500">
          {viewType === 'pipeline'
            ? 'No active offboardings match your filters'
            : 'No offboarding history found'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-end px-4 py-2 border-b border-slate-100">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Last Day</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Exit Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Manager</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map(row => {
                const { offboarding, employee, department, entity, location, manager, progress } = row;
                const progressPercent = progress.requiredTotal > 0 
                  ? Math.round((progress.requiredCompleted / progress.requiredTotal) * 100) 
                  : 100;
                const canComplete = progressPercent === 100 && ['draft', 'scheduled', 'in_progress'].includes(offboarding.status);
                const canCancel = ['draft', 'scheduled', 'in_progress'].includes(offboarding.status);

                return (
                  <tr key={offboarding.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-medium text-sm">
                          {employee ? getInitials(employee) : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {employee ? getDisplayName(employee) : 'Unknown'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {employee?.job_title || '—'}
                            {department ? ` · ${department.name}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {offboarding.last_day 
                        ? format(new Date(offboarding.last_day), 'MMM d, yyyy') 
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {EXIT_TYPE_LABELS[offboarding.exit_type] || offboarding.exit_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(offboarding.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>{progress.requiredCompleted}/{progress.requiredTotal}</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-1.5" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {manager ? getDisplayName(manager) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entity?.abbreviation || entity?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={createPageUrl('OffboardingManage') + `?id=${offboarding.id}`}>
                          <Button size="sm" variant="outline">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </Button>
                        </Link>
                        
                        {isAdmin && (canComplete || canCancel) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canComplete && (
                                <DropdownMenuItem onClick={() => setCompleteDialog(row)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                  Mark Completed
                                </DropdownMenuItem>
                              )}
                              {canComplete && canCancel && <DropdownMenuSeparator />}
                              {canCancel && (
                                <DropdownMenuItem 
                                  onClick={() => setCancelDialog(row)}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel Offboarding
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Dialog */}
      <CancelOffboardingDialog
        open={!!cancelDialog}
        onOpenChange={() => setCancelDialog(null)}
        onConfirm={handleCancel}
        isProcessing={isProcessing}
        employeeName={cancelDialog?.employee ? getDisplayName(cancelDialog.employee) : ''}
      />

      {/* Complete Dialog */}
      <CompleteOffboardingDialog
        open={!!completeDialog}
        onOpenChange={() => setCompleteDialog(null)}
        onConfirm={handleComplete}
        isProcessing={isProcessing}
        incompleteTasks={completeDialog?.progress?.requiredTotal - completeDialog?.progress?.requiredCompleted || 0}
      />
    </>
  );
}