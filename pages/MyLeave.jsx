import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { Card, CardContent } from '../components/ui/Card';
import LeaveStatusChip from '@/components/leave/LeaveStatusChip';
import { format } from 'date-fns';
import { Plus, X, AlertCircle, AlertTriangle, Info, Loader2, Clock } from 'lucide-react';
import { createLeaveRequest, cancelLeaveRequest } from '@/components/utils/leaveHelpers';
import { subscribeToLeaveCache, getLeaveEngineCacheVersion } from '@/components/utils/leaveEngineCache';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { 
  getLeaveContextForEmployee, 
  calculateChargeableLeave, 
  getLeaveHistoryForEmployee,
} from '@/components/utils/LeaveEngine';
import { initializeLeaveBalances } from '@/components/utils/leaveBalanceInit';
import { getLeaveBalancesForEmployee } from '@/components/utils/leaveBalanceService';
import LeaveBalanceTiles from '@/components/leave/LeaveBalanceTiles';
import { formatHours, safeNumber } from '@/components/utils/numberUtils';

import { useLocation } from 'react-router-dom';

const Employee = base44.entities.Employee;
const LeaveType = base44.entities.LeaveType;

export default function MyLeave() {
  // URL params: startDate + employeeId (for on-behalf)
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const startDateParam = params.get('startDate');
  const targetEmployeeIdParam = params.get('employeeId');
  const prefillStartDate = startDateParam || '';

  // Viewer context (current user) + target employee (self or report)
  const [userContext, setUserContext] = useState(null);
  const [targetEmployee, setTargetEmployee] = useState(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  // Leave data for the subject employee
  const [leaveContext, setLeaveContext] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(getLeaveEngineCacheVersion());

  // Form/UI state
  const [showForm, setShowForm] = useState(() => !!prefillStartDate);
  const [formData, setFormData] = useState(() => ({
    leave_type_id: '',
    start_date: prefillStartDate,
    end_date: prefillStartDate,
    reason: '',
    partial_day_type: 'full',
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Validation & debug
  const [leaveWarningDetails, setLeaveWarningDetails] = useState(null);
  const [balanceDebug, setBalanceDebug] = useState(null);
  const [chargeableBreakdown, setChargeableBreakdown] = useState(null);

  // Recall modal
  const [requestToRecall, setRequestToRecall] = useState(null);
  const [isRecalling, setIsRecalling] = useState(false);

  // Viewer (current logged-in employee)
  const currentEmployee = userContext?.employee;
  // Subject (the person whose leave we're managing)
  const subjectEmployee = targetEmployee || currentEmployee;

  // Central function to load all leave data for a given employee
  const loadLeaveContextFor = async (employeeId) => {
    if (!employeeId) return;
    
    try {
      await initializeLeaveBalances(employeeId);
      
      const [balances, ctx, history] = await Promise.all([
        getLeaveBalancesForEmployee(employeeId),
        getLeaveContextForEmployee(employeeId),
        getLeaveHistoryForEmployee(employeeId),
      ]);
      
      setLeaveBalances(balances);
      setLeaveContext(ctx);
      setRequests(history);
      setBalanceRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error loading employee leave data:', error);
    }
  };

  // Load viewer context + target employee + leave types + leave data
  useEffect(() => {
    async function loadContext() {
      try {
        const ctx = await getCurrentUserEmployeeContext();
        setUserContext(ctx);

        const types = await LeaveType.list();
        setLeaveTypes(types);

        let employeeToUse = ctx.employee || null;

        if (targetEmployeeIdParam) {
          const emp = await Employee.get(targetEmployeeIdParam);
          const isAdminActing = ctx.isAdmin && ctx.actingMode === 'admin';
          const isManager = ctx.employee?.is_manager === true;

          let canActFor = false;
          if (isAdminActing) {
            canActFor = true;
          } else if (emp.id === ctx.employee?.id) {
            canActFor = true;
          } else if (isManager) {
            const reports = await Employee.filter({
              manager_id: ctx.employee.id,
              status: 'active',
            });
            const reportIds = new Set(reports.map((r) => r.id));
            canActFor = reportIds.has(emp.id);
          }

          if (canActFor) {
            employeeToUse = emp;
          } else {
            employeeToUse = ctx.employee || null;
          }
        }

        setTargetEmployee(employeeToUse);

        if (employeeToUse) {
          await loadLeaveContextFor(employeeToUse.id);
        }
      } catch (err) {
        console.error('Error loading MyLeave context:', err);
      } finally {
        setIsLoadingContext(false);
      }
    }
    loadContext();
  }, [targetEmployeeIdParam]);

  const getTypeName = (id) => leaveTypes.find(t => t.id === id)?.name || 'Unknown';

  const canRecallRequest = (request) => {
    if (request.employee_id !== subjectEmployee?.id) return false;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const status = request.status;
    const startDate = request.start_date;
    
    if (status === 'pending') return true;
    if (status === 'approved' && startDate >= today) return true;
    return false;
  };

  const openRecallModal = (request) => {
    setRequestToRecall(request);
  };

  const handleConfirmRecall = async () => {
    if (!requestToRecall || !subjectEmployee || !userContext) return;
    
    setIsRecalling(true);
    
    try {
      const result = await cancelLeaveRequest(
        requestToRecall,
        subjectEmployee,
        userContext.user,
        currentEmployee,
        userContext.preferences
      );
      
      if (!result.success) {
        const errorMsg = result.error || 'Failed to recall leave request';
        toast.error(`Failed to recall leave request: ${errorMsg}`);
        setRequestToRecall(null);
        setIsRecalling(false);
        return;
      }
      
      setRequestToRecall(null);
      toast.success('Leave request recalled successfully.');
      await loadLeaveContextFor(subjectEmployee.id);
    } catch (err) {
      toast.error(`Failed to recall leave request: ${err.message || 'Unknown error'}`);
      setRequestToRecall(null);
    } finally {
      setIsRecalling(false);
    }
  };

  // Calculate chargeable days when dates or partial_day_type change
  useEffect(() => {
    if (!formData.start_date || !formData.end_date || !subjectEmployee) {
      setChargeableBreakdown(null);
      setLeaveWarningDetails(null);
      setBalanceDebug(null);
      return;
    }

    calculateChargeableLeave({
      start_date: formData.start_date,
      end_date: formData.end_date,
      employee_id: subjectEmployee.id,
      partial_day_type: formData.partial_day_type,
    }).then(breakdown => {
      setChargeableBreakdown(breakdown);
    });
  }, [formData.start_date, formData.end_date, formData.partial_day_type, subjectEmployee?.id]);

  // Check balance warning when inputs change
  useEffect(() => {
    if (!chargeableBreakdown || !formData.leave_type_id || !leaveContext || !subjectEmployee) {
      setLeaveWarningDetails(null);
      setBalanceDebug(null);
      return;
    }

    const chargeableDays = safeNumber(chargeableBreakdown.chargeableDays, 0);
    if (chargeableDays <= 0) {
      setLeaveWarningDetails(null);
      setBalanceDebug({ error: 'chargeableDays <= 0', chargeableDays });
      return;
    }

    const leaveType = leaveTypes.find(t => t.id === formData.leave_type_id);
    if (!leaveType) {
      setLeaveWarningDetails(null);
      setBalanceDebug({ error: 'leaveType not found', leaveTypeId: formData.leave_type_id });
      return;
    }

    const typeCode = (leaveType.code || leaveType.name || '').toLowerCase();
    let balanceKey = 'annual';
    if (typeCode.includes('personal') || typeCode.includes('sick') || typeCode.includes('carer')) {
      balanceKey = 'personal';
    } else if (typeCode.includes('long') || typeCode.includes('lsl')) {
      balanceKey = 'long_service';
    }

    const balance = leaveBalances?.[balanceKey];
    const policy = leaveContext.policies[balanceKey];

    if (!balance) {
      setLeaveWarningDetails(null);
      setBalanceDebug({ error: `no balance for key: ${balanceKey}`, balanceKey, typeCode });
      return;
    }

    const availableHoursRaw = balance?.available ?? balance?.available_hours ?? balance?.availableHours ?? 0;
    const availableHours = safeNumber(availableHoursRaw, 0);

    let hoursPerDay;
    if (Number.isFinite(policy?.standard_hours_per_day) && policy.standard_hours_per_day > 0) {
      hoursPerDay = policy.standard_hours_per_day;
    } else if (Number.isFinite(subjectEmployee?.hours_per_week) && subjectEmployee.hours_per_week > 0) {
      hoursPerDay = subjectEmployee.hours_per_week / 5;
    } else {
      hoursPerDay = 7.6;
    }

    const neededHours = safeNumber(chargeableDays * hoursPerDay, 0);

    const EPS = 0.01;
    const shouldWarn = availableHours + EPS < neededHours;

    if (shouldWarn) {
      setLeaveWarningDetails({ availableHours, neededHours });
    } else {
      setLeaveWarningDetails(null);
    }
  }, [chargeableBreakdown, formData.leave_type_id, leaveContext, subjectEmployee, leaveTypes, leaveBalances]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectEmployee || !userContext || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setError('Please complete all required fields');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const result = await createLeaveRequest({
        employee: subjectEmployee,
        leaveTypeId: formData.leave_type_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        reason: formData.reason,
        partialDayType: formData.partial_day_type,
        currentUser: userContext.user,
        currentEmployee: currentEmployee,
        preferences: userContext.preferences,
      });

      if (!result.success) {
        if (result.error === 'OVERLAPPING_LEAVE') {
          setError('You already have leave booked that overlaps these dates. Adjust the date range or cancel the existing leave first.');
        } else if (result.error === 'PAID_LEAVE_NOT_ALLOWED_FOR_CASUAL') {
          setError('Casual employees are not eligible for paid annual or personal leave. Please choose a different leave type.');
        } else if (result.error === 'PERMISSION_DENIED') {
          setError(result.message || 'Permission denied.');
        } else if (result.error === 'HALF_DAY_MUST_BE_SINGLE_DAY') {
          setError('Half-day leave is only available for single-day requests. Please make the start and end date the same or choose Full day.');
        } else {
          setError(result.error || 'Failed to submit request');
        }
        setIsSubmitting(false);
        return;
      }

      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '', partial_day_type: 'full' });
      setChargeableBreakdown(null);
      setShowForm(false);
      
      if (result.autoApproved) {
        setSuccessMessage('Leave request created and automatically approved (no manager assigned).');
      } else {
        setSuccessMessage('Leave request submitted for manager approval.');
      }

      await loadLeaveContextFor(subjectEmployee.id);
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingContext) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!subjectEmployee) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My time off</h1>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">No Employee Profile Linked</h3>
                <p className="text-yellow-700 mt-1">
                  Your user account is not linked to an employee profile. Please contact an administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My time off</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? 'Cancel' : 'Request Leave'}
        </Button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6">
          {successMessage}
        </div>
      )}

      {/* Recall Confirmation Modal */}
      <Dialog open={!!requestToRecall} onOpenChange={(open) => !open && setRequestToRecall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requestToRecall?.status === 'pending' ? 'Cancel leave request' : 'Recall leave request'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {requestToRecall?.status === 'pending' ? 'cancel' : 'recall'} this leave request?
              {requestToRecall?.status === 'approved' && (
                <span className="block mt-2">
                  Any approved leave for these dates will be cancelled and the leave balance will be updated.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {requestToRecall && (
            <div className="py-3 px-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium">{getTypeName(requestToRecall.leave_type_id)}</p>
              <p className="text-gray-600">
                {format(new Date(requestToRecall.start_date), 'dd MMM')} – {format(new Date(requestToRecall.end_date), 'dd MMM yyyy')}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRequestToRecall(null)} disabled={isRecalling}>
              No, keep it
            </Button>
            <Button variant="destructive" onClick={handleConfirmRecall} disabled={isRecalling}>
              {isRecalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Yes, ${requestToRecall?.status === 'pending' ? 'cancel' : 'recall'} leave`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {leaveContext && (
        <>
          {/* Leave balances */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your leave balances</h2>
            <LeaveBalanceTiles 
              employeeId={subjectEmployee.id} 
              refreshKey={balanceRefreshKey}
            />
            {subjectEmployee.employment_type === 'part_time' && subjectEmployee.hours_per_week && (
              <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                <Info className="h-3 w-3" />
                {subjectEmployee.preferred_name || subjectEmployee.full_name || 'This employee'} works {subjectEmployee.hours_per_week}h/week (~{Math.round((subjectEmployee.hours_per_week / 38) * 100)}% of full-time). Leave accrues pro-rata.
              </p>
            )}
          </div>

          {/* Leave request form */}
          {showForm && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-2">New Leave Request</h2>

                <div className="mb-4 text-sm text-gray-500">
                  Creating leave for{' '}
                  <span className="font-semibold">
                    {subjectEmployee?.preferred_name || subjectEmployee?.full_name}
                  </span>
                  {targetEmployeeIdParam && subjectEmployee?.id !== currentEmployee?.id && (
                    <span className="ml-1 inline-block rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 align-middle">
                      on behalf of
                    </span>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <Select
                      value={formData.leave_type_id}
                      onValueChange={(v) => setFormData({ ...formData, leave_type_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Day Duration - Full/Half day selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <RadioGroup
                      value={formData.partial_day_type}
                      onValueChange={(v) => setFormData({ ...formData, partial_day_type: v })}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full" id="duration-full" />
                        <Label htmlFor="duration-full" className="cursor-pointer">Full day</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="half_am" id="duration-half-am" />
                        <Label htmlFor="duration-half-am" className="cursor-pointer flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Half day (AM)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="half_pm" id="duration-half-pm" />
                        <Label htmlFor="duration-half-pm" className="cursor-pointer flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Half day (PM)
                        </Label>
                      </div>
                    </RadioGroup>
                    {/* Show warning if half-day selected but dates differ */}
                    {(formData.partial_day_type === 'half_am' || formData.partial_day_type === 'half_pm') && 
                     formData.start_date && formData.end_date && formData.start_date !== formData.end_date && (
                      <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Half-day leave is only available for single-day requests. Please choose the same start and end date.
                      </p>
                    )}
                  </div>

                  {/* Chargeable breakdown */}
                  {chargeableBreakdown && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total days in range:</span>
                        <span className="font-medium">{chargeableBreakdown.totalDays}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Weekends (excluded):</span>
                        <span className="text-gray-500">−{chargeableBreakdown.weekendCount}</span>
                      </div>
                      {chargeableBreakdown.holidayCount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Public holidays (excluded):</span>
                          <span className="text-gray-500">−{chargeableBreakdown.holidayCount}</span>
                        </div>
                      )}
                      {chargeableBreakdown.isHalfDay && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Half day:</span>
                          <span className="text-indigo-600 font-medium">
                            {chargeableBreakdown.partialDayType === 'half_am' ? 'Morning (AM)' : 'Afternoon (PM)'}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between">
                        <span className="font-medium">Chargeable days:</span>
                        <span className="text-lg font-bold text-indigo-600">
                          {chargeableBreakdown.chargeableDays}
                        </span>
                      </div>
                      {chargeableBreakdown.holidays.length > 0 && (
                        <div className="text-xs text-gray-500">
                          Holidays: {chargeableBreakdown.holidays.map(h => h.name).join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Balance warning banner */}
                  {leaveWarningDetails && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        Insufficient leave balance. You have {formatHours(leaveWarningDetails.availableHours)} hours available but need {formatHours(leaveWarningDetails.neededHours)} hours.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason (optional)
                    </label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting || !formData.leave_type_id}>
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Request history */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Request History</h2>
              </div>
              {requests.length === 0 ? (
                <p className="p-6 text-gray-500 text-center">No leave requests yet</p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {requests.map((req) => (
                    <div key={req.id} className="px-6 py-4 flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {getTypeName(req.leave_type_id)}
                          {/* Show half-day badge if applicable */}
                          {req.partial_day_type === 'half_am' && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              <Clock className="h-3 w-3" /> Half day (AM)
                            </span>
                          )}
                          {req.partial_day_type === 'half_pm' && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              <Clock className="h-3 w-3" /> Half day (PM)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(req.start_date), 'dd MMM')} –{' '}
                          {format(new Date(req.end_date), 'dd MMM yyyy')} ({req.total_days} {req.total_days === 0.5 ? 'day' : 'days'})
                        </p>
                        {req.reason && (
                          <p className="text-sm text-gray-400 mt-1">{req.reason}</p>
                        )}

                        {req.status === 'declined' && (req.rejection_reason || req.manager_comment) && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-sm">
                            <span className="text-red-600 font-medium">Reason: </span>
                            <span className="text-red-700">
                              {req.rejection_reason || req.manager_comment}
                            </span>
                          </div>
                        )}

                        {req.status === 'approved' && req.manager_comment && (
                          <p className="text-sm text-blue-600 mt-1">
                            Manager: {req.manager_comment}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                          <LeaveStatusChip status={req.status} />
                          {canRecallRequest(req) && (
                          <button
                            onClick={() => openRecallModal(req)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            {req.status === 'pending' ? 'Cancel request' : 'Recall'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}