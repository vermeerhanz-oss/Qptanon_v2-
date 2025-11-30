import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Flag } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, getDay, addMonths, subMonths } from 'date-fns';
import { getPublicHolidaysInRange } from '@/components/utils/publicHolidays';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Calendar component that overlays public holidays
 * Can be used in leave request views to show PH markers
 */
export default function LeaveCalendarOverlay({ 
  entityId, 
  stateRegion,
  leaveRequests = [],
  selectedMonth = new Date(),
  onMonthChange,
  compact = false
}) {
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  useEffect(() => {
    loadHolidays();
  }, [currentMonth, entityId, stateRegion]);

  const loadHolidays = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const phs = await getPublicHolidaysInRange(entityId, start, end, { stateRegion });
    setHolidays(phs);
  };

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    if (onMonthChange) onMonthChange(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    if (onMonthChange) onMonthChange(newMonth);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = getDay(monthStart);

  // Create holiday lookup
  const holidayMap = new Map();
  holidays.forEach(h => {
    holidayMap.set(h.date, h);
  });

  // Create leave request lookup
  const getLeaveForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return leaveRequests.filter(r => {
      return dateStr >= r.start_date && dateStr <= r.end_date;
    });
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (compact) {
    // Simple inline list of holidays for this month
    if (holidays.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1">
        {holidays.map((h, i) => (
          <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
            <Flag className="h-3 w-3 mr-1" />
            {h.name} ({format(parseISO(h.date), 'dd MMM')})
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(name => (
          <div key={name} className="text-center text-xs font-medium text-gray-500 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}
        
        {/* Days */}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const holiday = holidayMap.get(dateStr);
          const leaves = getLeaveForDay(day);
          const isWeekendDay = isWeekend(day);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateStr}
              className={`h-10 relative flex flex-col items-center justify-center rounded text-sm ${
                isWeekendDay ? 'bg-gray-50 text-gray-400' : ''
              } ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''} ${
                holiday ? 'bg-red-50' : ''
              }`}
              title={holiday ? `${holiday.name}` : undefined}
            >
              <span className={holiday ? 'text-red-600 font-medium' : ''}>
                {format(day, 'd')}
              </span>
              
              {/* Holiday indicator */}
              {holiday && (
                <div className="absolute top-0.5 right-0.5">
                  <Flag className="h-3 w-3 text-red-500" />
                </div>
              )}

              {/* Leave indicator */}
              {leaves.length > 0 && (
                <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                  {leaves.slice(0, 3).map((leave, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        leave.status === 'approved' ? 'bg-green-500' :
                        leave.status === 'pending' ? 'bg-amber-500' :
                        leave.status === 'declined' ? 'bg-red-500' : 'bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Flag className="h-3 w-3 text-red-500" />
          Public Holiday
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Approved
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          Pending
        </div>
      </div>

      {/* Holiday list for this month */}
      {holidays.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-gray-600 mb-2">Holidays this month:</p>
          <div className="space-y-1">
            {holidays.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-red-700">{h.name}</span>
                <span className="text-gray-500">{format(parseISO(h.date), 'EEE, dd MMM')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple holiday badge list for inline use
 */
export function HolidayBadgeList({ holidays = [] }) {
  if (holidays.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {holidays.map((h, i) => (
        <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
          <Flag className="h-3 w-3 mr-1" />
          {h.name}
        </Badge>
      ))}
    </div>
  );
}