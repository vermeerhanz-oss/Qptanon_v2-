import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Flag, ChevronRight, Plane, Users } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, isBefore, isAfter, startOfDay } from 'date-fns';
import { getPublicHolidaysInRange } from '@/components/utils/publicHolidays';
import { getDisplayFirstName } from '@/components/utils/displayName';
import { calculateChargeableLeave, getLeaveHistoryForEmployee } from '@/components/utils/LeaveEngine';

const LeaveRequest = base44.entities.LeaveRequest;

export default function UpcomingTimeOffCard({ 
  employee, 
  isManager = false, 
  directReports = [],
  className = '' 
}) {
  const [nextLeave, setNextLeave] = useState(null);
  const [nextLeaveChargeable, setNextLeaveChargeable] = useState(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [teamOnLeave, setTeamOnLeave] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employee) {
      loadData();
    }
  }, [employee?.id]);

  const loadData = async () => {
    setIsLoading(true);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    try {
      // Query LeaveRequest directly for approved/pending leave with start_date >= today
      const myLeaveRequests = await LeaveRequest.filter({ employee_id: employee.id });
      const futureLeave = myLeaveRequests
        .filter(lr => (lr.status === 'approved' || lr.status === 'pending') && lr.start_date >= todayStr)
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
      
      // Debug log for dashboard leave data
      console.log("DASHBOARD LEAVE DEBUG", {
        widget: "myUpcomingLeave",
        employeeId: employee.id,
        count: futureLeave.length,
        items: futureLeave.map(r => ({
          id: r.id,
          status: r.status,
          start_date: r.start_date,
          end_date: r.end_date,
        })),
      });
      
      if (futureLeave.length > 0) {
        const next = futureLeave[0];
        setNextLeave(next);

        // Calculate chargeable days for this leave
        const breakdown = await calculateChargeableLeave({
          start_date: next.start_date,
          end_date: next.end_date,
          employee_id: employee.id,
        });
        setNextLeaveChargeable(breakdown);
      } else {
        setNextLeave(null);
        setNextLeaveChargeable(null);
      }

      // Get upcoming public holidays
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 6);
      const holidays = await getPublicHolidaysInRange(
        employee.entity_id, 
        today, 
        endDate, 
        { stateRegion: employee.state }
      );
      setUpcomingHolidays(holidays.filter(h => h.date >= todayStr).slice(0, 3));

      // Get team on leave this week (for managers)
      if (isManager && directReports.length > 0) {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        
        const allApproved = await LeaveRequest.filter({ status: 'approved' });
        const reportIds = directReports.map(r => r.id);
        
        const teamLeave = allApproved.filter(lr => {
          if (!reportIds.includes(lr.employee_id)) return false;
          const start = parseISO(lr.start_date);
          const end = parseISO(lr.end_date);
          return !(isAfter(start, weekEnd) || isBefore(end, weekStart));
        });

        const enriched = teamLeave.map(lr => {
          const emp = directReports.find(r => r.id === lr.employee_id);
          return { ...lr, employee_name: emp ? getDisplayFirstName(emp) : 'Unknown' };
        });
        setTeamOnLeave(enriched);
        
        // Debug log for team leave
        console.log("DASHBOARD LEAVE DEBUG", {
          widget: "teamOnLeave",
          count: enriched.length,
          items: enriched.map(r => ({
            id: r.id,
            employee_name: r.employee_name,
            start_date: r.start_date,
            end_date: r.end_date,
          })),
        });
      }
    } catch (error) {
      console.error('Error loading time off data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasContent = nextLeave || upcomingHolidays.length > 0 || teamOnLeave.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Upcoming Time Off & Holidays
          </CardTitle>
          <Link to={createPageUrl('MyLeave')}>
            <Button variant="ghost" size="sm" className="text-indigo-600">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next approved leave */}
        {nextLeave && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Plane className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Your next leave</p>
                <p className="text-sm text-gray-600">
                  {format(parseISO(nextLeave.start_date), 'dd MMM')} - {format(parseISO(nextLeave.end_date), 'dd MMM yyyy')}
                </p>
                {nextLeaveChargeable && (
                  <p className="text-sm text-gray-500">
                    {nextLeaveChargeable.chargeableDays} chargeable day(s)
                    {nextLeaveChargeable.holidayCount > 0 && (
                      <span className="text-gray-400"> (excl. {nextLeaveChargeable.holidayCount} holiday{nextLeaveChargeable.holidayCount > 1 ? 's' : ''})</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Team on leave this week */}
        {isManager && teamOnLeave.length > 0 && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Team on leave this week</p>
                <div className="mt-1 space-y-1">
                  {teamOnLeave.slice(0, 3).map((lr, idx) => (
                    <p key={idx} className="text-sm text-gray-600">
                      {lr.employee_name} • {format(parseISO(lr.start_date), 'dd MMM')} - {format(parseISO(lr.end_date), 'dd MMM')}
                    </p>
                  ))}
                  {teamOnLeave.length > 3 && (
                    <p className="text-xs text-purple-600">+{teamOnLeave.length - 3} more</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming public holidays */}
        {upcomingHolidays.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Flag className="h-4 w-4 text-red-500" />
              Upcoming Public Holidays
            </p>
            <div className="space-y-2">
              {upcomingHolidays.map((holiday, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-900">{holiday.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(parseISO(holiday.date), 'EEE, dd MMM')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}