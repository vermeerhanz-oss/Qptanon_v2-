import React from 'react';
import { format, isToday, getDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import LeaveCalendarDayPopover from './LeaveCalendarDayPopover';

/**
 * Individual calendar day cell with leave indicators
 */
export default function CalendarDayCell({
  date,
  leaves = [],
  holiday,
  isTeamCalendar,
  employeesMap,
  isSelected,
  onSelect,
  onClose,
  onRequestLeave,
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = getDay(date);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isTodayDate = isToday(date);

  // Categorize leaves
  const approvedLeaves = leaves.filter(l => l.status === 'approved');
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const hasApproved = approvedLeaves.length > 0;
  const hasPending = pendingLeaves.length > 0;
  const leaveCount = leaves.length;

  // Check for half-day (only on single-day leave)
  const halfDayLeave = leaves.find(l => l.isHalfDay);
  const isHalfDayAM = halfDayLeave?.partialDayType === 'half_am';
  const isHalfDayPM = halfDayLeave?.partialDayType === 'half_pm';

  // Determine cell styling
  let bgClass = 'bg-white';
  let textClass = 'text-gray-700';
  let borderClass = '';

  if (hasApproved && !halfDayLeave) {
    bgClass = 'bg-green-500';
    textClass = 'text-white font-medium';
  } else if (hasPending && !hasApproved) {
    bgClass = 'bg-amber-100';
    borderClass = 'border-2 border-dashed border-amber-400';
    textClass = 'text-amber-800';
  } else if (holiday && !hasApproved && !hasPending) {
    bgClass = 'bg-red-50';
    textClass = 'text-red-700';
  } else if (isWeekend) {
    bgClass = 'bg-gray-50';
    textClass = 'text-gray-400';
  }

  const todayRing = isTodayDate ? 'ring-2 ring-indigo-500 ring-offset-1' : '';
  const selectedRing = isSelected ? 'ring-2 ring-gray-400' : '';

  // Build tooltip
  let tooltipText = '';
  if (isTeamCalendar && leaveCount > 0) {
    tooltipText = `${leaveCount} ${leaveCount === 1 ? 'person' : 'people'} on leave`;
  } else if (hasApproved) {
    tooltipText = halfDayLeave 
      ? `Half day (${isHalfDayAM ? 'AM' : 'PM'}) - approved` 
      : 'Leave (approved)';
  } else if (hasPending) {
    tooltipText = halfDayLeave 
      ? `Half day (${isHalfDayAM ? 'AM' : 'PM'}) - pending` 
      : 'Leave (pending)';
  } else if (holiday) {
    tooltipText = holiday.name;
  }

  return (
    <Popover open={isSelected} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>
        <button
          role="gridcell"
          title={tooltipText}
          onClick={() => onSelect(dateStr)}
          className={`
            aspect-square flex items-center justify-center text-xs rounded-md 
            cursor-pointer relative transition-all duration-150
            hover:scale-105 hover:z-10 hover:shadow-sm
            ${bgClass} ${borderClass} ${textClass} ${todayRing} ${selectedRing}
          `}
        >
          {/* Half-day visual split */}
          {halfDayLeave && (
            <div className="absolute inset-0 rounded-md overflow-hidden flex pointer-events-none">
              <div className={`w-1/2 ${isHalfDayAM ? (hasApproved ? 'bg-green-500' : 'bg-amber-300') : ''}`} />
              <div className={`w-1/2 ${isHalfDayPM ? (hasApproved ? 'bg-green-500' : 'bg-amber-300') : ''}`} />
            </div>
          )}
          
          {/* Day number */}
          <span className={`relative z-10 ${halfDayLeave ? 'text-gray-800 font-medium' : ''}`}>
            {format(date, 'd')}
          </span>

          {/* Holiday indicator dot */}
          {holiday && (
            <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full ${
              (hasApproved || hasPending) ? 'ring-1 ring-white' : ''
            }`} />
          )}

          {/* Team calendar: count badge */}
          {isTeamCalendar && leaveCount > 1 && (
            <div className="absolute -bottom-0.5 -right-0.5 min-w-[14px] h-3.5 bg-gray-800 text-white text-[9px] rounded-full flex items-center justify-center px-1 font-medium">
              {leaveCount}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="start">
        <LeaveCalendarDayPopover
          dateStr={dateStr}
          leaves={leaves}
          holiday={holiday}
          isTeamCalendar={isTeamCalendar}
          employees={employeesMap}
          onClose={onClose}
          onRequestLeave={!isTeamCalendar && onRequestLeave ? () => onRequestLeave(dateStr) : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}