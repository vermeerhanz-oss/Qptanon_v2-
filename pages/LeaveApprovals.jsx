import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO, startOfToday } from 'date-fns';
import { Check, X, List, Calendar, Loader2, Clock, Filter, Users } from 'lucide-react';
import { approveLeaveRequest, declineLeaveRequest } from '@/components/utils/leaveHelpers';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { 
  getPendingRequestsForApproval, 
  calculateChargeableLeave, 
  getLeaveContextForEmployee,
  canUserActOnLeave,
  ensureLeaveBalances
} from '@/components/utils/LeaveEngine';
import { invalidateLeaveCache } from '@/components/utils/leaveEngineCache';
import LeaveModeIndicator from '@/components/leave/LeaveModeIndicator';
import { checkStaffingConflict, enrichOverlappingLeave } from '@/components/utils/staffingRules';
import InteractiveLeaveCalendar from '@/components/leave/InteractiveLeaveCalendar';
import LeaveApprovalCard from '@/components/leave/LeaveApprovalCard';
import LeaveStatusChip from '@/components/leave/LeaveStatusChip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const Employee = base44.entities.Employee;
const LeaveType = base44.entities.LeaveType;
const LeaveRequest = base44.entities.LeaveRequest;
const Department = base44.entities.Department;

const STATUS_FILTERS = [
  { key: 'all', label: 'All', icon: Filter },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'approved', label: 'Approved', icon: Check },
  { key: 'declined', label: 'Declined' },
];

export default function LeaveApprovals() {
  const [userContext, setUserContext] = useState(null);
  const [allRequests, setAllRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requestContexts, setRequestContexts] = useState({});
  const [chargeableBreakdowns, setChargeableBreakdowns] = useState({});
  const [staffingConflicts, setStaffingConflicts] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [comments, setComments] = useState({});
  const [statusFilter, setStatusFilter] = useState('pending');
  const [viewMode, setViewMode] = useState('list');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, request: null, action: null });

  const { isAllowed, isLoading: permLoading } = useRequirePermission(userContext, 'canApproveLeave');

  // Build maps for fast lookup
  const employeesMap = useMemo(() => {
    const map = {};
    employees.forEach(e => { map[e.id] = e; });
    return map;
  }, [employees]);

  const departmentsMap = useMemo(() => {
    const map = {};
    departments.forEach(d => { map[d.id] = d; });
    return map;
  }, [departments]);

  const leaveTypesMap = useMemo(() => {
    const map = {};
    leaveTypes.forEach(t => { map[t.id] = t; });
    return map;
  }, [leaveTypes]);

  // Filter requests based on manager permissions
  const visibleEmployeeIds = useMemo(() => {
    if (!userContext || !employees.length) return new Set();
    
    const isAdminActing = userContext.isAdmin && userContext.actingMode === 'admin';
    const isManagerActing = userContext.employee?.is_manager === true;
    
    if (isAdminActing) {
      return new Set(employees.map(e => e.id));
    } else if (isManagerActing && userContext.employee) {
      return new Set(
        employees.filter(e => e.manager_id === userContext.employee.id).map(e => e.id)
      );
    }
    return new Set();
  }, [userContext, employees]);

  // Filter requests by status and visibility
  const filteredRequests = useMemo(() => {
    let requests = allRequests.filter(r => visibleEmployeeIds.has(r.employee_id));
    
    if (statusFilter !== 'all') {
      requests = requests.filter(r => r.status === statusFilter);
    }
    
    // Sort by start_date ascending for pending, descending for others
    requests.sort((a, b) => {
      if (statusFilter === 'pending' || a.status === 'pending') {
        return (a.start_date || '').localeCompare(b.start_date || '');
      }
      return (b.start_date || '').localeCompare(a.start_date || '');
    });
    
    return requests;
  }, [allRequests, visibleEmployeeIds, statusFilter]);

  // Team calendar requests
  const teamLeaveRequests = useMemo(() => {
    return allRequests.filter(r => 
      (r.status === 'approved' || r.status === 'pending') && visibleEmployeeIds.has(r.employee_id)
    );
  }, [allRequests, visibleEmployeeIds]);

  // Count by status for filter badges
  const statusCounts = useMemo(() => {
    const counts = { all: 0, pending: 0, approved: 0, declined: 0, cancelled: 0 };
    allRequests.filter(r => visibleEmployeeIds.has(r.employee_id)).forEach(r => {
      counts.all++;
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [allRequests, visibleEmployeeIds]);

  const loadData = useCallback(async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setUserContext(ctx);

      if (!ctx.permissions?.canApproveLeave) {
        setDataLoading(false);
        return;
      }

      const [emps, depts, types, reqs] = await Promise.all([
        Employee.list(),
        Department.list(),
        LeaveType.list(),
        LeaveRequest.list(),
      ]);
      
      setEmployees(emps);
      setDepartments(depts);
      setLeaveTypes(types);
      setAllRequests(reqs);

      // Build employee map for conflict enrichment
      const empMap = {};
      emps.forEach(e => { empMap[e.id] = e; });

      // Load contexts and breakdowns for pending requests only (performance optimization)
      const pendingReqs = reqs.filter(r => r.status === 'pending');
      const contexts = {};
      const breakdowns = {};
      const conflicts = {};

      await Promise.all(pendingReqs.map(async (req) => {
        try {
          await ensureLeaveBalances(req.employee_id);
        } catch (e) { /* ignore */ }

        try {
          const leaveCtx = await getLeaveContextForEmployee(req.employee_id);
          contexts[req.id] = leaveCtx;
        } catch (e) { /* ignore */ }

        try {
          const breakdown = await calculateChargeableLeave({
            start_date: req.start_date,
            end_date: req.end_date,
            employee_id: req.employee_id,
            partial_day_type: req.partial_day_type,
          });
          breakdowns[req.id] = breakdown;
        } catch (e) { /* ignore */ }

        const emp = empMap[req.employee_id];
        if (emp) {
          try {
            const conflictResult = await checkStaffingConflict(req, emp);
            if (conflictResult.hasConflict) {
              const enriched = await enrichOverlappingLeave(conflictResult.overlappingLeave, emps);
              conflicts[req.id] = { ...conflictResult, overlappingEmployees: enriched };
            }
          } catch (e) { /* ignore */ }
        }
      }));

      setRequestContexts(contexts);
      setChargeableBreakdowns(breakdowns);
      setStaffingConflicts(conflicts);
    } catch (error) {
      console.error('Error loading approvals:', error);
      toast.error('Failed to load leave requests.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getBalanceForRequest = (req) => {
    const ctx = requestContexts[req.id];
    if (!ctx) return null;

    const leaveType = leaveTypesMap[req.leave_type_id];
    const typeCode = leaveType?.code?.toLowerCase() || leaveType?.name?.toLowerCase();
    
    let balanceKey = 'annual';
    if (typeCode?.includes('personal') || typeCode?.includes('sick')) {
      balanceKey = 'personal';
    } else if (typeCode?.includes('long') || typeCode?.includes('lsl')) {
      balanceKey = 'long_service';
    }

    const balance = ctx.balances?.[balanceKey];
    const policy = ctx.policies?.[balanceKey];
    
    return {
      balance,
      policy,
      availableHours: balance?.availableHours ?? balance?.available_hours ?? balance?.available ?? 0,
      standardHoursPerDay: policy?.standard_hours_per_day ?? balance?.standardHoursPerDay ?? 7.6,
    };
  };

  const hasLeaveStarted = (req) => {
    const today = format(startOfToday(), 'yyyy-MM-dd');
    return req.start_date < today;
  };

  const openConfirmDialog = (request, action) => {
    const comment = comments[request.id] || '';
    if (action === 'decline' && !comment.trim()) {
      toast.error('A decline reason is required.');
      return;
    }
    setConfirmDialog({ open: true, request, action });
  };

  const handleConfirmedAction = async () => {
    const { request, action } = confirmDialog;
    if (!request || !action) return;
    
    setConfirmDialog({ open: false, request: null, action: null });
    const comment = comments[request.id] || '';

    setProcessingId(request.id);
    try {
      const emp = employeesMap[request.employee_id];
      let result;
      if (action === 'approve') {
        result = await approveLeaveRequest(request, emp, comment, userContext.user, userContext.employee, userContext.preferences);
      } else {
        result = await declineLeaveRequest(request, comment, userContext.user, userContext.employee, userContext.preferences);
      }

      if (!result.success) {
        toast.error(result.error || 'Action failed. Please try again.');
        setProcessingId(null);
        return;
      }

      // Invalidate cache and refresh
      invalidateLeaveCache(request.employee_id);
      setComments(prev => ({ ...prev, [request.id]: '' }));
      toast.success(action === 'approve' ? 'Leave approved successfully.' : 'Leave request declined.');
      await loadData();
    } catch (error) {
      console.error('Error processing request:', error);
      toast.error('Failed to update leave request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (dataLoading || permLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-gray-500 text-sm">Loading leave requests...</p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Users className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            You don't have permission to view leave approvals.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdminMode = userContext?.actingMode === 'admin' && userContext?.isAdmin;
  const confirmEmployee = confirmDialog.request ? employeesMap[confirmDialog.request.employee_id] : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Approvals</h1>
            <p className="text-gray-500 text-sm mt-1">Review and act on pending leave requests from your team.</p>
          </div>
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="bg-gray-100">
              <TabsTrigger value="list" className="flex items-center gap-1.5 text-sm">
                <List className="h-4 w-4" />
                Requests
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <LeaveModeIndicator isAdminMode={isAdminMode} className="mt-4" />
      </div>

      {/* Status filters - only for list view */}
      {viewMode === 'list' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map(({ key, label }) => (
            <Button
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className={statusFilter === key ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
            >
              {label}
              {statusCounts[key] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${
                  statusFilter === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {statusCounts[key]}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Team Calendar View */}
      {viewMode === 'calendar' && (
        <InteractiveLeaveCalendar
          isTeamCalendar={true}
          teamLeaveRequests={teamLeaveRequests}
          employeesMap={employeesMap}
          entityId={userContext?.employee?.entity_id}
          stateRegion={userContext?.employee?.state}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  {statusFilter === 'pending' ? (
                    <Check className="h-6 w-6 text-green-500" />
                  ) : (
                    <Filter className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <h3 className="font-medium text-gray-900 mb-1">
                  {statusFilter === 'pending' 
                    ? 'All caught up!' 
                    : `No ${statusFilter} requests`}
                </h3>
                <p className="text-gray-500 text-sm">
                  {statusFilter === 'pending'
                    ? 'There are no leave requests requiring your approval.'
                    : `There are no ${statusFilter} leave requests for your team.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredRequests.map((req) => {
              const emp = employeesMap[req.employee_id];
              const dept = emp?.department_id ? departmentsMap[emp.department_id] : null;
              const breakdown = chargeableBreakdowns[req.id];
              const balanceInfo = getBalanceForRequest(req);
              const permCheck = canUserActOnLeave(userContext, req, 'approve');
              const leaveStarted = hasLeaveStarted(req);
              const canAction = permCheck.canAct && !leaveStarted;

              return (
                <LeaveApprovalCard
                  key={req.id}
                  request={req}
                  employee={emp}
                  department={dept}
                  leaveTypeName={leaveTypesMap[req.leave_type_id]?.name || 'Leave'}
                  breakdown={breakdown}
                  balanceInfo={balanceInfo}
                  staffingConflict={staffingConflicts[req.id]}
                  comment={comments[req.id] || ''}
                  onCommentChange={(val) => setComments(prev => ({ ...prev, [req.id]: val }))}
                  onApprove={() => openConfirmDialog(req, 'approve')}
                  onDecline={() => openConfirmDialog(req, 'decline')}
                  isProcessing={processingId === req.id}
                  canAction={canAction}
                  permissionReason={permCheck.reason}
                  leaveStarted={leaveStarted}
                />
              );
            })
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, request: null, action: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmDialog.action === 'approve' ? (
                <>
                  <div className="p-1.5 rounded-full bg-green-100">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  Approve Leave Request?
                </>
              ) : (
                <>
                  <div className="p-1.5 rounded-full bg-red-100">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                  Decline Leave Request?
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {confirmEmployee && confirmDialog.request && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-900">
                      {confirmEmployee.preferred_name || confirmEmployee.first_name} {confirmEmployee.last_name}
                    </p>
                    <p className="text-gray-600">
                      {leaveTypesMap[confirmDialog.request.leave_type_id]?.name || 'Leave'} • {' '}
                      {format(parseISO(confirmDialog.request.start_date), 'dd MMM')} – {' '}
                      {format(parseISO(confirmDialog.request.end_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                )}
                <p className="text-gray-600">
                  {confirmDialog.action === 'approve'
                    ? 'This will approve the leave request and deduct the hours from the employee\'s balance.'
                    : 'This will decline the leave request. The employee will be notified.'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedAction}
              disabled={processingId !== null}
              className={confirmDialog.action === 'approve' 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'}
            >
              {processingId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                confirmDialog.action === 'approve' ? 'Approve' : 'Decline'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}