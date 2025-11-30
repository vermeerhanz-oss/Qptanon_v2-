import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/Card';
import LeaveStatusChip from '@/components/leave/LeaveStatusChip';
import { format } from 'date-fns';
import { Users, Loader2, AlertCircle, Plus, Calendar, Clock, ShieldAlert } from 'lucide-react';
import { toast } from "sonner";
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { getDirectReportsForManager, getAllEmployeesForAdmin } from '@/components/utils/employeeHelpers';
import { createLeaveAsManager } from '@/components/utils/leaveHelpers';
import { getDisplayName } from '@/components/utils/displayName';
import { calculateChargeableLeave } from '@/components/utils/LeaveEngine';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const LeaveRequest = base44.entities.LeaveRequest;
const LeaveType = base44.entities.LeaveType;

export default function TeamLeave() {
  const [userContext, setUserContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [chargeableBreakdown, setChargeableBreakdown] = useState(null);

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // Permission check
  const isAdmin = userContext?.isAdmin && userContext?.actingMode === 'admin';
  const isManager = userContext?.employee?.is_manager === true;
  const hasAccess = isAdmin || isManager;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setUserContext(ctx);

      // Load leave types
      const types = await LeaveType.list();
      setLeaveTypes(types);

      // Load team members based on role
      const ctxIsAdmin = ctx.isAdmin && ctx.actingMode === 'admin';
      const ctxIsManager = ctx.employee?.is_manager === true;

      if (ctxIsAdmin) {
        const allEmps = await getAllEmployeesForAdmin();
        setTeamMembers(allEmps);
      } else if (ctxIsManager && ctx.employee?.id) {
        const reports = await getDirectReportsForManager(ctx.employee.id);
        setTeamMembers(reports);
      }
    } catch (error) {
      console.error('Error loading team leave data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load leave history when employee is selected
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeLeaveHistory([]);
      return;
    }
    loadEmployeeLeaveHistory(selectedEmployeeId);
  }, [selectedEmployeeId]);

  const loadEmployeeLeaveHistory = async (employeeId) => {
    setHistoryLoading(true);
    try {
      // Verify user can view this employee's leave (they must be in teamMembers list)
      const canView = teamMembers.some(e => e.id === employeeId);
      if (!canView) {
        console.warn('Access denied: Cannot view leave for employee', employeeId);
        setEmployeeLeaveHistory([]);
        setHistoryLoading(false);
        return;
      }
      
      const requests = await LeaveRequest.filter({ employee_id: employeeId });
      // Sort by start_date descending
      requests.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
      setEmployeeLeaveHistory(requests);
    } catch (error) {
      console.error('Error loading leave history:', error);
      setEmployeeLeaveHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Calculate chargeable days when dates change
  useEffect(() => {
    if (!formData.start_date || !formData.end_date || !selectedEmployeeId) {
      setChargeableBreakdown(null);
      return;
    }

    calculateChargeableLeave({
      start_date: formData.start_date,
      end_date: formData.end_date,
      employee_id: selectedEmployeeId,
    }).then(breakdown => {
      setChargeableBreakdown(breakdown);
    }).catch(() => setChargeableBreakdown(null));
  }, [formData.start_date, formData.end_date, selectedEmployeeId]);

  const getTypeName = (id) => leaveTypes.find(t => t.id === id)?.name || 'Unknown';
  const getSelectedEmployee = () => teamMembers.find(e => e.id === selectedEmployeeId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedEmployeeId || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setFormError('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createLeaveAsManager({
        managerId: userContext.employee?.id,
        employeeId: selectedEmployeeId,
        leaveTypeId: formData.leave_type_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        reason: formData.reason,
        currentUser: userContext.user,
        managerEmployee: userContext.employee,
        preferences: userContext.preferences,
      });

      if (!result.success) {
        // Map error codes to friendly messages
        const errorMessages = {
          INSUFFICIENT_BALANCE: 'This employee does not have enough leave balance.',
          OVERLAPPING_LEAVE: 'This employee already has leave booked in this period.',
          CASUAL_CANNOT_TAKE_PAID_LEAVE: 'Casual employees cannot take paid annual/personal leave.',
          NOT_AUTHORIZED: result.message || 'You are not authorized to create leave for this employee.',
          EMPLOYEE_NOT_FOUND: 'Employee not found.',
        };
        setFormError(errorMessages[result.error] || result.message || 'Failed to create leave.');
        setIsSubmitting(false);
        return;
      }

      const emp = getSelectedEmployee();
      const empName = emp ? getDisplayName(emp) : 'the employee';
      toast.success(`Leave created and approved for ${empName}.`);

      // Reset form
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      setChargeableBreakdown(null);

      // Refresh leave history
      await loadEmployeeLeaveHistory(selectedEmployeeId);
    } catch (error) {
      console.error('Error creating leave:', error);
      setFormError(error.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };



  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Access denied for non-managers/admins
  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <ShieldAlert className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800">Access Denied</h3>
                <p className="text-red-700 mt-1">
                  You need to be a manager or admin to access this page.
                </p>
                <Link to={createPageUrl('Home')}>
                  <Button variant="outline" className="mt-4">
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No direct reports (manager with no team)
  if (!isAdmin && teamMembers.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Team Leave</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-700">No Direct Reports</h3>
            <p className="text-gray-500 mt-2">
              You don't have any direct reports assigned yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Leave</h1>
        <p className="text-gray-500 text-sm mt-1">Create and manage leave for your team members</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Employee selector + Create form */}
        <div className="lg:col-span-1 space-y-6">
          {/* Employee Selector */}
          <Card>
            <CardContent className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Employee
              </label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {getDisplayName(emp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Create Leave Form */}
          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-500" />
                Create Leave
              </h2>

              {!selectedEmployeeId ? (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">Select an employee to create leave on their behalf.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {formError}
                    </div>
                  )}

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
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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

                  {/* Chargeable breakdown */}
                  {chargeableBreakdown && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total days:</span>
                        <span className="font-medium">{chargeableBreakdown.totalDays}</span>
                      </div>
                      {chargeableBreakdown.weekendCount > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Weekends excluded:</span>
                          <span>−{chargeableBreakdown.weekendCount}</span>
                        </div>
                      )}
                      {chargeableBreakdown.holidayCount > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Public holidays:</span>
                          <span>−{chargeableBreakdown.holidayCount}</span>
                        </div>
                      )}
                      <div className="border-t pt-1 flex justify-between font-medium">
                        <span>Chargeable days:</span>
                        <span className="text-indigo-600">{chargeableBreakdown.chargeableDays}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <Textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      rows={2}
                      placeholder="Add a reason..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !formData.leave_type_id}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create & Approve Leave'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Leave history */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  Leave History
                </h2>
                {selectedEmployeeId && (
                  <span className="text-sm text-gray-500">
                    {getDisplayName(getSelectedEmployee())}
                  </span>
                )}
              </div>

              {!selectedEmployeeId ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                  <p>Select an employee to view their leave history.</p>
                </div>
              ) : historyLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : employeeLeaveHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Clock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                  <p>No leave recorded yet for this employee.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {employeeLeaveHistory.map((req) => (
                    <div key={req.id} className="px-5 py-4 flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{getTypeName(req.leave_type_id)}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(req.start_date), 'dd MMM')} – {format(new Date(req.end_date), 'dd MMM yyyy')}
                          {req.total_days && (
                            <span className="text-gray-400 ml-2">({req.total_days} days)</span>
                          )}
                        </p>
                        {req.reason && (
                          <p className="text-sm text-gray-400 mt-1">{req.reason}</p>
                        )}
                      </div>
                      <LeaveStatusChip status={req.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}