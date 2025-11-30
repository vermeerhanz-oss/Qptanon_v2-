import React from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ExternalLink, CalendarDays, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getDisplayName } from '@/components/utils/displayName';

/**
 * Popover content for clicking on a calendar day
 * @param {Object} props
 * @param {string} props.dateStr - The date string (YYYY-MM-DD)
 * @param {Array}  props.leaves - Leave entries for this day
 * @param {Object} props.holiday - Public holiday object if present
 * @param {boolean} props.isTeamCalendar - Whether this is the team calendar (shows employee names)
 * @param {Object} props.employees - Map of employee_id -> employee object (for team calendar)
 * @param {Function} props.onClose - Close the popover
 * @param {Function} [props.onRequestLeave] - Callback when "Request leave" is clicked (personal calendar only)
 */
export default function LeaveCalendarDayPopover({
  dateStr,
  leaves = [],
  holiday,
  isTeamCalendar = false,
  employees = {},
  onClose,
  onRequestLeave,
}) {
  const date = parseISO(dateStr);
  const hasLeave = leaves.length > 0;

  return (
    <div className="w-80 max-h-96 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <div>
          <p className="font-semibold text-gray-900">
            {format(date, 'EEEE, d MMMM yyyy')}
          </p>
          {holiday && (
            <p className="text-sm text-red-600 flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3 w-3" />
              {holiday.name}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {hasLeave ? (
          <div className="space-y-2">
            {leaves.map((leave, idx) => {
              const emp = isTeamCalendar ? employees[leave.employee_id] : null;
              const empName = isTeamCalendar
                ? (emp ? getDisplayName(emp) : 'Unknown')
                : 'You';

              return (
                <div
                  key={leave.id || idx}
                  className="bg-white border rounded-lg p-3 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {empName}
                        </span>
                        <Badge
                          className={
                            leave.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }
                        >
                          {leave.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {format(parseISO(leave.start_date), 'dd MMM')} –{' '}
                        {format(parseISO(leave.end_date), 'dd MMM yyyy')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {leave.total_days != null && (
                          <p className="text-xs text-gray-400">
                            {leave.total_days} {leave.total_days === 0.5 ? 'day' : 'days'}
                          </p>
                        )}
                        {leave.totalDays != null && !leave.total_days && (
                          <p className="text-xs text-gray-400">
                            {leave.totalDays} {leave.totalDays === 0.5 ? 'day' : 'days'}
                          </p>
                        )}
                        {(leave.partial_day_type === 'half_am' || leave.partial_day_type === 'half_pm' ||
                          leave.partialDayType === 'half_am' || leave.partialDayType === 'half_pm') && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            <Clock className="h-2.5 w-2.5" />
                            {(leave.partial_day_type === 'half_am' || leave.partialDayType === 'half_am') ? 'AM' : 'PM'}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={createPageUrl('MyLeave') + `?highlight=${leave.id}`}
                      className="text-indigo-600 hover:text-indigo-800 p-1"
                      title="View request"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-3">No leave booked</p>
          </div>
        )}

        {/* Request leave button — only for personal calendar, only if a handler is provided */}
        {!isTeamCalendar && onRequestLeave && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onRequestLeave(dateStr)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Request leave starting this day
          </Button>
        )}
      </div>
    </div>
  );
}