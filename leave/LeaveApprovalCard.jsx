import React from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/Avatar';
import { Check, X, Clock, Building2, AlertTriangle } from 'lucide-react';
import LeaveStatusChip from './LeaveStatusChip';
import StaffingConflictWarning from './StaffingConflictWarning';
import { getDisplayName } from '@/components/utils/displayName';
import { formatDays, safeNumber } from '@/components/utils/numberUtils';
import { balanceHoursToDays } from '@/components/utils/leaveBalanceService';

/**
 * Individual leave request card for the approvals page
 */
export default function LeaveApprovalCard({
  request,
  employee,
  department,
  leaveTypeName,
  breakdown,
  balanceInfo,
  staffingConflict,
  comment,
  onCommentChange,
  onApprove,
  onDecline,
  isProcessing,
  canAction,
  permissionReason,
  leaveStarted,
}) {
  const isHalfDay = request.partial_day_type === 'half_am' || request.partial_day_type === 'half_pm';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar firstName={employee?.first_name} lastName={employee?.last_name} size="md" />
            <div>
              <p className="font-semibold text-gray-900">
                {employee ? getDisplayName(employee) : 'Unknown Employee'}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {employee?.job_title && <span>{employee.job_title}</span>}
                {department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {department.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <LeaveStatusChip status={request.status} />
        </div>

        {/* Details row */}
        <div className="p-4 bg-gray-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Leave Type</span>
              <span className="font-medium text-gray-900">{leaveTypeName}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Dates</span>
              <span className="font-medium text-gray-900">
                {format(parseISO(request.start_date), 'dd MMM')} – {format(parseISO(request.end_date), 'dd MMM yyyy')}
              </span>
              {isHalfDay && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-indigo-600 font-medium">
                  <Clock className="h-2.5 w-2.5" />
                  {request.partial_day_type === 'half_am' ? 'AM' : 'PM'}
                </span>
              )}
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Days</span>
              <span className="font-medium text-gray-900">
                {breakdown?.chargeableDays ?? request.total_days ?? '–'}
                {breakdown?.holidayCount > 0 && (
                  <span className="text-gray-400 text-xs ml-1">
                    (excl. {breakdown.holidayCount} PH)
                  </span>
                )}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Balance</span>
              <span className="font-medium text-gray-900">
                {balanceInfo?.availableHours != null
                  ? `${formatDays(safeNumber(balanceHoursToDays(safeNumber(balanceInfo.availableHours, 0), balanceInfo.standardHoursPerDay), 0))} days`
                  : '–'}
              </span>
            </div>
          </div>

          {request.reason && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="text-gray-500 text-xs">Reason:</span>
              <p className="text-sm text-gray-700 mt-0.5">{request.reason}</p>
            </div>
          )}
        </div>

        {/* Staffing conflict warning */}
        {staffingConflict && (
          <div className="px-4 pb-3">
            <StaffingConflictWarning 
              conflictResult={staffingConflict}
              overlappingEmployees={staffingConflict.overlappingEmployees}
            />
          </div>
        )}

        {/* Actions row - only for pending requests */}
        {request.status === 'pending' && (
          <div className="p-4 border-t border-gray-100 bg-white">
            {leaveStarted ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                Leave has already started and cannot be actioned.
              </div>
            ) : canAction ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a comment (required for decline)"
                  value={comment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={onApprove}
                    disabled={isProcessing}
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    {isProcessing ? 'Processing...' : 'Approve'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onDecline}
                    disabled={isProcessing}
                    size="sm"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    {isProcessing ? 'Processing...' : 'Decline'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">{permissionReason}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}