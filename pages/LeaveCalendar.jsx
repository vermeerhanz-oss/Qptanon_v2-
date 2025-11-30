import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { getTeamLeaveForCalendar } from '@/components/utils/leaveCalendarHelpers';
import { subscribeToLeaveCache } from '@/components/utils/leaveEngineCache';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Users, Calendar, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InteractiveLeaveCalendar from '@/components/leave/InteractiveLeaveCalendar';
import { createPageUrl } from '@/utils';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { getDisplayName } from '@/components/utils/displayName';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;

export default function LeaveCalendar() {
  const navigate = useNavigate();
  const [userContext, setUserContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamLeaveRequests, setTeamLeaveRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState({});
  const [departments, setDepartments] = useState([]);
  const [directReports, setDirectReports] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to cache invalidation for auto-refresh
  useEffect(() => {
    const unsubscribe = subscribeToLeaveCache(() => {
      setRefreshKey(prev => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Navigate to MyLeave with pre-filled start date
  const handleRequestLeave = useCallback((date) => {
    if (!date) return;
    const iso = typeof date === 'string' ? date : date.toISOString?.() || new Date(date).toISOString();
    const dateOnly = iso.slice(0, 10);
    navigate(createPageUrl('MyLeave') + `?startDate=${encodeURIComponent(dateOnly)}`);
  }, [navigate]);

  // Load all data in a single optimized fetch
  useEffect(() => {
    async function loadContext() {
      try {
        const ctx = await getCurrentUserEmployeeContext();
        setUserContext(ctx);
        
        const isAdminActing = ctx.isAdmin && ctx.actingMode === 'admin';
        const isManagerActing = ctx.employee?.is_manager === true;
        const isManagerOrAdmin = isAdminActing || isManagerActing;
        
        if (isManagerOrAdmin && ctx.employee) {
          const year = new Date().getFullYear();
          const startDate = `${year}-01-01`;
          const endDate = `${year}-12-31`;
          
          // Single optimized query for all team leave data
          const result = await getTeamLeaveForCalendar({
            startDate,
            endDate,
            user: ctx.user,
            currentEmployee: ctx.employee,
            preferences: ctx.preferences,
          });
          
          // Map normalized leave back to the format expected by InteractiveLeaveCalendar
          const leaveForCalendar = result.leave.map(l => ({
            id: l.id,
            employee_id: l.employeeId,
            leave_type_id: l.leaveTypeId,
            status: l.status,
            start_date: l.startDate,
            end_date: l.endDate,
            total_days: l.totalDays,
            partial_day_type: l.partialDayType,
            reason: l.reason,
          }));
          
          setTeamLeaveRequests(leaveForCalendar);
          setEmployeesMap(result.employees);
          setDepartments(result.departments);
          
          // Get direct reports for the dropdown
          const allEmployees = Object.values(result.employees);
          const reports = allEmployees.filter(e => e.manager_id === ctx.employee.id && e.status === 'active');
          setDirectReports(reports);
        }
      } catch (err) {
        console.error('Error loading leave calendar:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadContext();
  }, [refreshKey]);

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm text-gray-500">Loading calendar...</p>
      </div>
    );
  }

  const hasNoEmployeeProfile = !userContext?.employee;

  // Non-admin with no employee profile
  if (hasNoEmployeeProfile && !userContext?.isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Leave Calendar</h1>
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

  // Admin with no employee profile
  if (hasNoEmployeeProfile && userContext?.isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Leave Calendar</h1>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Users className="h-6 w-6 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-800">No Employee Profile</h3>
                <p className="text-blue-700 mt-1">
                  Your admin account is not linked to an employee profile. To view a personal leave calendar, please link your account to an employee record.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdminActing = userContext?.isAdmin && userContext?.actingMode === 'admin';
  const isManagerActing = userContext?.employee?.is_manager === true;
  const isManagerOrAdmin = isAdminActing || isManagerActing;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Calendar</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isManagerOrAdmin 
            ? 'View your personal leave and team availability at a glance.' 
            : 'View and manage your leave requests.'}
        </p>
      </div>
      
      {isManagerOrAdmin ? (
        <Tabs defaultValue="personal" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="personal" className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                My Calendar
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Team Calendar
              </TabsTrigger>
            </TabsList>

            {/* Manager/Admin: Create leave on behalf of a report */}
            {directReports?.length > 0 && (
              <Select
                onValueChange={(employeeId) => {
                  navigate(createPageUrl('MyLeave') + `?employeeId=${encodeURIComponent(employeeId)}`);
                }}
              >
                <SelectTrigger className="w-52 h-9 text-sm">
                  <SelectValue placeholder="Create leave for…" />
                </SelectTrigger>
                <SelectContent>
                  {directReports.map((dr) => (
                    <SelectItem key={dr.id} value={dr.id}>
                      {getDisplayName(dr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <TabsContent value="personal" className="mt-0">
            <InteractiveLeaveCalendar 
              employee={userContext.employee} 
              onRequestLeave={handleRequestLeave}
            />
          </TabsContent>
          
          <TabsContent value="team" className="mt-0">
            <InteractiveLeaveCalendar
              isTeamCalendar={true}
              teamLeaveRequests={teamLeaveRequests}
              employeesMap={employeesMap}
              departments={departments}
              entityId={userContext.employee?.entity_id}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <InteractiveLeaveCalendar 
          employee={userContext.employee} 
          onRequestLeave={handleRequestLeave}
        />
      )}
    </div>
  );
}