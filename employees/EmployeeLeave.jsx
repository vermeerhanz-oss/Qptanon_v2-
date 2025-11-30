import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { format, differenceInBusinessDays } from 'date-fns';
import { Plus, X, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { isAdmin } from '@/components/utils/permissions';
import { createLeaveRequest } from '@/components/utils/leaveHelpers';
import LeaveBalancePanel from '@/components/leave/LeaveBalancePanel';
import { hoursToDays, accrueLeaveForEmployee, recalculateAllBalancesForEmployee } from '@/components/utils/leaveAccrual';
import { formatDays, safeNumber } from '@/components/utils/numberUtils';

const LeaveBalance = base44.entities.LeaveBalance;
const LeaveRequest = base44.entities.LeaveRequest;
const LeaveType = base44.entities.LeaveType;
const LeavePolicy = base44.entities.LeavePolicy;

export function EmployeeLeave({ employeeId, employee, user }) {
  const [balances, setBalances] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [leaveWarningDetails, setLeaveWarningDetails] = useState(null);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const loadData = async () => {
    try {
      // Event-driven accrual: accrue up to today before showing balances
      await accrueLeaveForEmployee(employeeId, new Date());
      
      const [bals, reqs, types, pols] = await Promise.all([
        LeaveBalance.filter({ employee_id: employeeId }),
        LeaveRequest.filter({ employee_id: employeeId }, '-created_date'),
        LeaveType.list(),
        LeavePolicy.filter({ is_active: true }),
      ]);
      setBalances(bals);
      setRequests(reqs);
      setLeaveTypes(types);
      setPolicies(pols);
    } catch (error) {
      console.error('Error loading leave data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const getTypeName = (id) => leaveTypes.find(t => t.id === id)?.name || 'Unknown';

  const calculateBusinessDays = (start, end) => {
    if (!start || !end) return 0;
    return differenceInBusinessDays(new Date(end), new Date(start)) + 1;
  };

  // Check balance when form changes - consolidated warning logic
  useEffect(() => {
    // Clear warning if form is incomplete
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setLeaveWarningDetails(null);
      return;
    }

    const leaveType = leaveTypes.find(t => t.id === formData.leave_type_id);
    if (!leaveType) {
      setLeaveWarningDetails(null);
      return;
    }

    const leaveTypeCode = (leaveType.code || leaveType.name || '').toLowerCase();
    const balance = balances.find(b => 
      b.leave_type === leaveTypeCode || 
      (b.leave_type === 'annual' && leaveTypeCode.includes('annual')) ||
      (b.leave_type === 'personal' && (leaveTypeCode.includes('personal') || leaveTypeCode.includes('sick')))
    );

    if (!balance) {
      setLeaveWarningDetails(null);
      return;
    }

    const chargeableDays = calculateBusinessDays(formData.start_date, formData.end_date);
    if (chargeableDays <= 0) {
      setLeaveWarningDetails(null);
      return;
    }

    const policy = policies.find(p => p.leave_type === balance.leave_type);
    
    // Derive hoursPerDay using same logic as front-end and server
    let hoursPerDay;
    if (Number.isFinite(policy?.standard_hours_per_day) && policy.standard_hours_per_day > 0) {
      hoursPerDay = policy.standard_hours_per_day;
    } else if (Number.isFinite(employee?.hours_per_week) && employee.hours_per_week > 0) {
      hoursPerDay = employee.hours_per_week / 5;
    } else {
      hoursPerDay = 7.6;
    }

    const neededHours = safeNumber(chargeableDays * hoursPerDay, 0);
    const availableHours = safeNumber(balance.available_hours, 0);

    const EPS = 0.01;
    if (neededHours > availableHours + EPS) {
      setLeaveWarningDetails({ availableHours, neededHours });
    } else {
      setLeaveWarningDetails(null);
    }
  }, [formData.leave_type_id, formData.start_date, formData.end_date, balances, leaveTypes, policies, employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const totalDays = calculateBusinessDays(formData.start_date, formData.end_date);

      const result = await createLeaveRequest({
        employee: employee,
        leaveTypeId: formData.leave_type_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        totalDays: totalDays,
        reason: formData.reason,
      });

      if (!result.success) {
        setError(result.error || 'Failed to submit request');
        setIsSubmitting(false);
        return;
      }

      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      setShowForm(false);
      
      if (result.autoApproved) {
        setSuccessMessage('Leave request created and automatically approved (no manager assigned).');
      } else {
        setSuccessMessage('Leave request submitted for manager approval.');
      }

      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userCanCreateRequest = isAdmin(user);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateAllBalancesForEmployee(employeeId);
      await loadData();
      setSuccessMessage('Leave balances recalculated successfully.');
    } catch (err) {
      setError('Failed to recalculate balances.');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin actions */}
      {userCanCreateRequest && (
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            {isRecalculating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Recalculate Balances
          </Button>
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
            {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showForm ? 'Cancel' : 'Request Leave'}
          </Button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Leave request form */}
      {showForm && userCanCreateRequest && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              New Leave Request
              <span className="text-sm font-normal text-gray-500 ml-2">
                (for {employee?.first_name} {employee?.last_name})
              </span>
            </h3>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <Select value={formData.leave_type_id} onValueChange={(v) => setFormData({ ...formData, leave_type_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
              {formData.start_date && formData.end_date && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">
                    Duration: {calculateBusinessDays(formData.start_date, formData.end_date)} business days
                  </p>
                  {leaveWarningDetails && (
                    <p className="text-sm text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Insufficient leave balance. You have {leaveWarningDetails.availableHours.toFixed(1)} hours available but need {leaveWarningDetails.neededHours.toFixed(1)} hours.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
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

      {/* Leave balances */}
      <LeaveBalancePanel balances={balances} policies={policies} />

      {/* Leave history */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Leave History</h3>
          </div>
          {requests.length === 0 ? (
            <p className="p-6 text-gray-500 text-center">No leave requests</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {requests.map((req) => (
                <div key={req.id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{getTypeName(req.leave_type_id)}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(req.start_date), 'dd MMM')} – {format(new Date(req.end_date), 'dd MMM yyyy')} ({req.total_days} days)
                    </p>
                    {req.reason && <p className="text-sm text-gray-400 mt-1">{req.reason}</p>}
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}