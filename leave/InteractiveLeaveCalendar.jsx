import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  isToday,
  getYear,
} from 'date-fns';
import { getPublicHolidaysInRange } from '@/components/utils/publicHolidays';
import { getLeaveHistoryForEmployee } from '@/components/utils/LeaveEngine';
import { subscribeToLeaveCache } from '@/components/utils/leaveEngineCache';
import CalendarLegend from './CalendarLegend';
import CalendarFilters from './CalendarFilters';
import LeaveCalendarDayPopover from './LeaveCalendarDayPopover';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function InteractiveLeaveCalendar({
  employee,
  teamLeaveRequests,
  employeesMap = {},
  isTeamCalendar = false,
  onRequestLeave,
  entityId,
  stateRegion,
  departments = [],
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to cache invalidation for auto-refresh
  useEffect(() => {
    const unsubscribe = subscribeToLeaveCache(() => {
      setRefreshKey(prev => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Navigation handlers with useCallback
  const handlePrevYear = useCallback(() => setYear(y => y - 1), []);
  const handleNextYear = useCallback(() => setYear(y => y + 1), []);
  const goToToday = useCallback(() => setYear(getYear(new Date())), []);

  // Load data when year or refresh key changes
  useEffect(() => {
    loadYearData();
  }, [employee?.id, year, teamLeaveRequests, isTeamCalendar, refreshKey]);

  const loadYearData = async () => {
    setIsLoading(true);
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      let requests = [];
      if (isTeamCalendar && teamLeaveRequests) {
        // Team calendar: use pre-fetched data
        requests = teamLeaveRequests.filter((req) => {
          if (req.status !== 'approved' && req.status !== 'pending') return false;
          return req.end_date >= yearStart && req.start_date <= yearEnd;
        });
      } else if (employee) {
        // Personal calendar: fetch own leave
        const history = await getLeaveHistoryForEmployee(employee.id);
        requests = history.filter((req) => {
          if (req.status !== 'approved' && req.status !== 'pending') return false;
          return req.end_date >= yearStart && req.start_date <= yearEnd;
        });
      }
      setLeaveRequests(requests);

      // Fetch public holidays
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      const effEntityId = entityId || employee?.entity_id;

      const holidays = await getPublicHolidaysInRange(
        effEntityId,
        startDate,
        endDate,
        { stateRegion: stateRegion || employee?.state },
      );
      setPublicHolidays(holidays);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build holiday map for O(1) lookup
  const holidayMap = useMemo(() => {
    const map = {};
    publicHolidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [publicHolidays]);

  // Filter leave requests based on current filters
  const filteredLeaveRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      // Status filter
      if (statusFilter === 'approved' && req.status !== 'approved') return false;
      if (statusFilter === 'pending' && req.status !== 'pending') return false;
      
      // Department filter (team calendar only)
      if (isTeamCalendar && departmentFilter !== 'all') {
        const emp = employeesMap[req.employee_id];
        if (!emp || emp.department_id !== departmentFilter) return false;
      }
      
      // Employee filter
      if (employeeFilter.length > 0) {
        if (!employeeFilter.includes(req.employee_id)) return false;
      }
      
      return true;
    });
  }, [leaveRequests, statusFilter, departmentFilter, employeeFilter, isTeamCalendar, employeesMap]);

  // Build date-indexed leave map for fast rendering
  const leaveDateMap = useMemo(() => {
    const dateMap = {};
    
    filteredLeaveRequests.forEach(req => {
      const start = parseISO(req.start_date);
      const end = parseISO(req.end_date);
      const isSingleDay = req.start_date === req.end_date;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = [];
        }
        
        dateMap[dateStr].push({
          ...req,
          isHalfDay: isSingleDay && (req.partial_day_type === 'half_am' || req.partial_day_type === 'half_pm'),
          partialDayType: req.partial_day_type || 'full',
        });
      }
    });
    
    return dateMap;
  }, [filteredLeaveRequests]);

  // Get unique employees for filter dropdown
  const visibleEmployees = useMemo(() => {
    if (!isTeamCalendar) return [];
    const empIds = new Set(leaveRequests.map(r => r.employee_id));
    return Object.values(employeesMap).filter(e => empIds.has(e.id));
  }, [isTeamCalendar, leaveRequests, employeesMap]);

  const hasActiveFilters = statusFilter !== 'all' || departmentFilter !== 'all' || employeeFilter.length > 0;

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setDepartmentFilter('all');
    setEmployeeFilter([]);
  }, []);

  const handleDayClick = useCallback((dateStr) => {
    setSelectedDay(dateStr);
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedDay(null);
  }, []);

  const handleRequestLeaveClick = useCallback((dateStr) => {
    setSelectedDay(null);
    if (onRequestLeave) {
      onRequestLeave(dateStr);
    }
  }, [onRequestLeave]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm text-gray-500">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handlePrevYear} disabled={isLoading}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {year - 1}
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{year}</h2>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            <CalendarDays className="h-4 w-4 mr-1" />
            Today
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleNextYear} disabled={isLoading}>
          {year + 1}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg px-4 py-3">
        <CalendarLegend showHalfDay={true} />
      </div>

      {/* Filters (team calendar only) */}
      {isTeamCalendar && (
        <CalendarFilters
          departments={departments}
          employees={visibleEmployees}
          selectedDepartment={departmentFilter}
          onDepartmentChange={setDepartmentFilter}
          selectedStatus={statusFilter}
          onStatusChange={setStatusFilter}
          selectedEmployees={employeeFilter}
          onEmployeeChange={setEmployeeFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {/* Personal calendar status filter */}
      {!isTeamCalendar && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Show:</span>
          <div className="flex gap-1">
            {['all', 'approved', 'pending'].map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? 'bg-indigo-600' : ''}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MONTHS.map((monthName, monthIndex) => (
          <MonthGrid
            key={`${year}-${monthIndex}`}
            year={year}
            month={monthIndex}
            monthName={monthName}
            leaveDateMap={leaveDateMap}
            holidayMap={holidayMap}
            onDayClick={handleDayClick}
            selectedDay={selectedDay}
            isTeamCalendar={isTeamCalendar}
            employeesMap={employeesMap}
            onRequestLeave={handleRequestLeaveClick}
            onClosePopover={handleClosePopover}
          />
        ))}
      </div>
    </div>
  );
}

// Memoized month grid component
const MonthGrid = React.memo(function MonthGrid({
  year,
  month,
  monthName,
  leaveDateMap,
  holidayMap,
  onDayClick,
  selectedDay,
  isTeamCalendar,
  employeesMap,
  onRequestLeave,
  onClosePopover,
}) {
  const firstDay = startOfMonth(new Date(year, month));
  const lastDay = endOfMonth(new Date(year, month));
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const startDayOfWeek = getDay(firstDay);
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  return (
    <Card className="overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b">
        <h3 className="font-semibold text-gray-700 text-sm">{monthName}</h3>
      </div>
      <CardContent className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_HEADERS.map((day, idx) => (
            <div key={idx} className="text-center text-[10px] text-gray-400 font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: offset }).map((_, idx) => (
            <div key={`empty-${idx}`} className="aspect-square" />
          ))}

          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const leaves = leaveDateMap[dateStr] || [];
            const holiday = holidayMap[dateStr];
            const dayOfWeek = getDay(day);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isTodayDate = isToday(day);
            const isSelected = selectedDay === dateStr;

            const hasApprovedLeave = leaves.some((l) => l.status === 'approved');
            const hasPendingLeave = leaves.some((l) => l.status === 'pending');
            const leaveCount = leaves.length;
            
            // Half-day detection
            const halfDayLeave = leaves.find((l) => l.isHalfDay);
            const isHalfDayAM = halfDayLeave?.partialDayType === 'half_am';
            const isHalfDayPM = halfDayLeave?.partialDayType === 'half_pm';

            // Determine styling
            let bgClass = '';
            let textClass = 'text-gray-700';
            let borderClass = '';
            const todayRing = isTodayDate ? 'ring-2 ring-indigo-500 ring-offset-1' : '';

            if (halfDayLeave) {
              // Half-day: use split styling
              bgClass = 'bg-white';
              textClass = 'text-gray-700 font-medium';
            } else if (hasApprovedLeave) {
              bgClass = 'bg-green-500';
              textClass = 'text-white font-medium';
            } else if (hasPendingLeave) {
              bgClass = 'bg-amber-100';
              borderClass = 'border-2 border-dashed border-amber-400';
              textClass = 'text-amber-800';
            } else if (holiday) {
              bgClass = 'bg-red-50';
              textClass = 'text-red-700';
            } else if (isWeekend) {
              textClass = 'text-gray-400';
            }

            let tooltipText = '';
            if (isTeamCalendar && leaveCount > 0) {
              tooltipText = `${leaveCount} ${leaveCount === 1 ? 'person' : 'people'} on leave`;
            } else if (hasApprovedLeave) {
              tooltipText = halfDayLeave ? `Half day (${isHalfDayAM ? 'AM' : 'PM'}) - approved` : 'Leave (approved)';
            } else if (hasPendingLeave) {
              tooltipText = halfDayLeave ? `Half day (${isHalfDayAM ? 'AM' : 'PM'}) - pending` : 'Leave (pending)';
            } else if (holiday) {
              tooltipText = holiday.name;
            }

            return (
              <Popover
                key={dateStr}
                open={isSelected}
                onOpenChange={(open) => !open && onClosePopover()}
              >
                <PopoverTrigger asChild>
                  <button
                    role="gridcell"
                    title={tooltipText}
                    onClick={() => onDayClick(dateStr)}
                    className={`aspect-square flex items-center justify-center text-xs rounded-md cursor-pointer relative transition-all duration-150 hover:scale-105 hover:z-10 ${bgClass} ${borderClass} ${textClass} ${todayRing} ${isSelected ? 'ring-2 ring-gray-400' : ''}`}
                  >
                    {/* Half-day split background */}
                    {halfDayLeave && (
                      <div className="absolute inset-0 rounded-md overflow-hidden flex pointer-events-none">
                        <div className={`w-1/2 ${isHalfDayAM ? (hasApprovedLeave ? 'bg-green-500' : 'bg-amber-300') : 'bg-gray-100'}`} />
                        <div className={`w-1/2 ${isHalfDayPM ? (hasApprovedLeave ? 'bg-green-500' : 'bg-amber-300') : 'bg-gray-100'}`} />
                      </div>
                    )}
                    
                    <span className={`relative z-10 ${halfDayLeave ? 'drop-shadow-sm' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Holiday indicator dot */}
                    {holiday && (
                      <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full ${(hasApprovedLeave || hasPendingLeave) ? 'ring-1 ring-white' : ''}`} />
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
                    onClose={onClosePopover}
                    onRequestLeave={!isTeamCalendar && onRequestLeave ? () => onRequestLeave(dateStr) : undefined}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});