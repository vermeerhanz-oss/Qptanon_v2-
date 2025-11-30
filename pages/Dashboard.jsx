import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, isWithinInterval, addDays, startOfToday, endOfToday } from 'date-fns';
import { 
  Users, Calendar, UserPlus, FileText, ArrowRight, 
  Briefcase, Clock, Loader2, CheckCircle2 
} from 'lucide-react';
import { isAdmin, isManager } from '@/components/utils/permissions';
import { getDisplayName, getDisplayFirstName, getInitials } from '@/components/utils/displayName';
import LeaveBalanceTiles from '@/components/leave/LeaveBalanceTiles';
import { subscribeToLeaveCache, getLeaveEngineCacheVersion } from '@/components/utils/leaveEngineCache';

const Employee = base44.entities.Employee;
const LeaveRequest = base44.entities.LeaveRequest;
const LeaveType = base44.entities.LeaveType;
const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const EmployeeOnboardingTask = base44.entities.EmployeeOnboardingTask;
const Policy = base44.entities.Policy;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;
const Department = base44.entities.Department;

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const employees = await Employee.list();
      const currentEmp = employees.find(e => e.email === currentUser.email || e.user_id === currentUser.id);
      setEmployee(currentEmp);

      const isFounderView = isAdmin(currentUser) || isManager(currentUser);

      if (isFounderView) {
        await loadFounderDashboard(employees, currentEmp, currentUser);
      } else {
        await loadEmployeeDashboard(currentEmp);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFounderDashboard = async (employees, currentEmp, currentUser) => {
    const today = startOfToday();
    const todayEnd = endOfToday();
    const sevenDaysLater = addDays(today, 7);

    // Get active employees
    const activeEmployees = employees.filter(e => e.status === 'active');

    // Get departments for display
    const departments = await Department.list();
    const deptMap = {};
    departments.forEach(d => deptMap[d.id] = d.name);

    // Get all approved leave requests
    const allLeave = await LeaveRequest.filter({ status: 'approved' });
    const leaveTypes = await LeaveType.list();
    const typeMap = {};
    leaveTypes.forEach(t => typeMap[t.id] = t.name);

    // People on leave today
    const onLeaveToday = allLeave.filter(r => {
      const start = parseISO(r.start_date);
      const end = parseISO(r.end_date);
      return isWithinInterval(today, { start, end });
    }).map(r => ({
      ...r,
      employee: employees.find(e => e.id === r.employee_id),
      typeName: typeMap[r.leave_type_id] || 'Leave',
    }));

    // People at work today = active employees NOT on leave today
    const onLeaveIds = new Set(onLeaveToday.map(r => r.employee_id));
    const atWorkToday = activeEmployees.filter(e => !onLeaveIds.has(e.id)).map(e => ({
      ...e,
      departmentName: deptMap[e.department_id] || null,
    }));

    // Upcoming leave (next 7 days)
    const upcomingLeave = allLeave.filter(r => {
      const start = parseISO(r.start_date);
      return start >= today && start <= sevenDaysLater;
    });

    // Onboarding data
    const onboardings = await EmployeeOnboarding.filter({ status: 'in_progress' });
    const allOnboardingTasks = await EmployeeOnboardingTask.list();
    
    // Open onboarding tasks (not completed)
    const openTasks = allOnboardingTasks.filter(t => 
      t.status !== 'completed' && onboardings.some(o => o.id === t.onboarding_id)
    );

    // Upcoming onboardings (top 5)
    const upcomingOnboardings = onboardings
      .map(o => ({
        ...o,
        employee: employees.find(e => e.id === o.employee_id),
        taskCount: allOnboardingTasks.filter(t => t.onboarding_id === o.id && t.status !== 'completed').length,
      }))
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
      .slice(0, 5);

    // Policy acknowledgements
    const policies = await Policy.filter({ is_active: true, is_mandatory: true });
    const acknowledgements = await PolicyAcknowledgement.list();
    
    const pendingPolicies = policies.map(p => {
      const acked = acknowledgements.filter(a => a.policy_id === p.id);
      const ackedEmployeeIds = new Set(acked.map(a => a.employee_id));
      const pendingCount = activeEmployees.filter(e => !ackedEmployeeIds.has(e.id)).length;
      return {
        id: p.id,
        name: p.name,
        pendingCount,
        totalEmployees: activeEmployees.length,
      };
    }).filter(p => p.pendingCount > 0);

    setDashboardData({
      type: 'founder',
      totalEmployees: activeEmployees.length,
      upcomingLeaveCount: upcomingLeave.length,
      openTasksCount: openTasks.length,
      atWorkToday: atWorkToday.slice(0, 10),
      atWorkTotalCount: atWorkToday.length,
      onLeaveToday,
      upcomingOnboardings,
      pendingPolicies: pendingPolicies.slice(0, 5),
    });
  };

  const loadEmployeeDashboard = async (currentEmp) => {
    if (!currentEmp) {
      setDashboardData({ type: 'employee', noProfile: true });
      return;
    }

    // Get pending onboarding tasks for this employee
    const onboardings = await EmployeeOnboarding.filter({ employee_id: currentEmp.id, status: 'in_progress' });
    let onboardingTasks = [];
    if (onboardings.length > 0) {
      const tasks = await EmployeeOnboardingTask.filter({ onboarding_id: onboardings[0].id });
      onboardingTasks = tasks.filter(t => t.status !== 'completed' && t.assigned_to_role === 'employee');
    }

    // Get pending policies for this employee
    const policies = await Policy.filter({ is_active: true, is_mandatory: true });
    const acks = await PolicyAcknowledgement.filter({ employee_id: currentEmp.id });
    const ackedPolicyIds = new Set(acks.map(a => a.policy_id));
    const pendingPolicies = policies.filter(p => !ackedPolicyIds.has(p.id));

    setDashboardData({
      type: 'employee',
      employeeId: currentEmp.id,
      onboardingTasks: onboardingTasks.slice(0, 5),
      pendingPolicies,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const displayName = employee ? getDisplayFirstName(employee) : (user?.full_name?.split(' ')[0] || 'there');

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Welcome back, {displayName}
        </h1>
        <p className="text-gray-500 mt-1">Here's your team at a glance</p>
      </div>

      {dashboardData?.type === 'founder' && <FounderDashboard data={dashboardData} />}
      {dashboardData?.type === 'employee' && <EmployeeDashboard data={dashboardData} />}
    </div>
  );
}

function FounderDashboard({ data }) {
  return (
    <div className="space-y-8">
      {/* Row 1: Key Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to={createPageUrl('Employees')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Employees</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{data.totalEmployees}</p>
                  <p className="text-xs text-gray-400 mt-1">Active employees</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('LeaveApprovals')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Upcoming Leave</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{data.upcomingLeaveCount}</p>
                  <p className="text-xs text-gray-400 mt-1">Next 7 days</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('OnboardingDashboard')}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Open Onboarding Tasks</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{data.openTasksCount}</p>
                  <p className="text-xs text-gray-400 mt-1">Pending completion</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Row 2: People Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* People at work today */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">At Work Today</h2>
              </div>
              <Badge className="bg-green-100 text-green-700">{data.atWorkTotalCount}</Badge>
            </div>
            {data.atWorkToday.length === 0 ? (
              <p className="text-sm text-gray-500">No employees at work today</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {data.atWorkToday.map(emp => (
                  <Link
                    key={emp.id}
                    to={createPageUrl('EmployeeProfile') + `?id=${emp.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                      {getInitials(emp)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{getDisplayName(emp)}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {emp.job_title || emp.departmentName || '—'}
                      </p>
                    </div>
                  </Link>
                ))}
                {data.atWorkTotalCount > 10 && (
                  <p className="text-xs text-gray-400 text-center pt-2">
                    +{data.atWorkTotalCount - 10} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* People on leave today */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">On Leave Today</h2>
              </div>
              <Badge className="bg-blue-100 text-blue-700">{data.onLeaveToday.length}</Badge>
            </div>
            {data.onLeaveToday.length === 0 ? (
              <p className="text-sm text-gray-500">No one on leave today</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {data.onLeaveToday.map(leave => (
                  <div key={leave.id} className="flex items-center gap-3 p-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xs font-medium">
                      {leave.employee ? getInitials(leave.employee) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {leave.employee ? getDisplayName(leave.employee) : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">{leave.typeName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Work in Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Onboarding */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Onboarding</h2>
              </div>
              <Link to={createPageUrl('OnboardingDashboard')}>
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            {data.upcomingOnboardings.length === 0 ? (
              <p className="text-sm text-gray-500">No active onboardings</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingOnboardings.map(onb => (
                  <Link
                    key={onb.id}
                    to={createPageUrl('OnboardingManage') + `?id=${onb.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:border-purple-200 hover:bg-purple-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium">
                        {onb.employee ? getInitials(onb.employee) : '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {onb.employee ? getDisplayName(onb.employee) : 'New Hire'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {onb.start_date ? format(parseISO(onb.start_date), 'dd MMM yyyy') : 'TBD'}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700">
                      {onb.taskCount} tasks
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Policies */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Pending Policies</h2>
              </div>
              <Link to={createPageUrl('PolicyLibrary')}>
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            {data.pendingPolicies.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                All policies acknowledged
              </div>
            ) : (
              <div className="space-y-3">
                {data.pendingPolicies.map(policy => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{policy.name}</p>
                      <p className="text-xs text-gray-500">
                        {policy.pendingCount} of {policy.totalEmployees} pending
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">
                      {policy.pendingCount} pending
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard({ data }) {
  const [cacheVersion, setCacheVersion] = useState(getLeaveEngineCacheVersion());

  // Subscribe to leave cache invalidation for instant balance refresh
  useEffect(() => {
    const unsubscribe = subscribeToLeaveCache((version) => {
      setCacheVersion(version);
    });
    return unsubscribe;
  }, []);

  if (data.noProfile) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p>No employee profile found for your account.</p>
          <p className="text-sm mt-2">Please contact your administrator.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Leave Balances using shared component */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-gray-900">Your Leave Balances</h2>
            </div>
            <Link to={createPageUrl('MyLeave')}>
              <Button variant="ghost" size="sm" className="text-indigo-600">
                Request Leave <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <LeaveBalanceTiles employeeId={data.employeeId} refreshKey={cacheVersion} compact={true} />
        </CardContent>
      </Card>

      {/* Pending Policies */}
      {data.pendingPolicies.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-amber-800">Action Required</h2>
              <p className="text-sm text-amber-700 mt-1">
                You have {data.pendingPolicies.length} policy document(s) requiring acknowledgement.
              </p>
              <Link to={createPageUrl('MyPolicies')}>
                <Button className="mt-4 bg-amber-600 hover:bg-amber-700 text-white">
                  Review Policies
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tasks */}
      {data.onboardingTasks.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-green-500" />
              <h2 className="text-lg font-semibold text-gray-900">Your Onboarding Tasks</h2>
            </div>
            <div className="space-y-3">
              {data.onboardingTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate">{task.description}</p>
                    )}
                  </div>
                  {task.due_date && (
                    <Badge className="bg-blue-100 text-blue-700">
                      Due {format(parseISO(task.due_date), 'dd MMM')}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            <Link to={createPageUrl('MyOnboarding')}>
              <Button variant="outline" className="w-full mt-4">
                View All Tasks <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}