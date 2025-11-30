import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Network, Calendar, Settings, Rocket, 
  CheckCircle2, ArrowRight, MapPin, Briefcase,
  UserPlus, UserMinus, Clock, Loader2
} from 'lucide-react';
import { isAdmin, isManager } from '@/components/utils/permissions';
import { getDisplayFirstName, getDisplayName, getInitials } from '@/components/utils/displayName';
import UpcomingTimeOffCard from '@/components/home/UpcomingTimeOffCard';

const Employee = base44.entities.Employee;
const LeaveRequest = base44.entities.LeaveRequest;
const OnboardingTask = base44.entities.OnboardingTask;
const OnboardingInstance = base44.entities.OnboardingInstance;
const OffboardingTask = base44.entities.OffboardingTask;
const OffboardingInstance = base44.entities.OffboardingInstance;
const Location = base44.entities.Location;

export default function Home() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [todos, setTodos] = useState([]);
  const [directReports, setDirectReports] = useState([]);
  const [locations, setLocations] = useState({});
  const [isLoading, setIsLoading] = useState(true);

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

      // Load locations for reference
      const locs = await Location.list();
      const locMap = {};
      locs.forEach(l => locMap[l.id] = l.name);
      setLocations(locMap);

      // Load direct reports
      if (currentEmp) {
        const reports = employees.filter(e => e.manager_id === currentEmp.id && e.status !== 'terminated');
        setDirectReports(reports);
      }

      // Load to-do items
      const todoItems = [];

      // Leave approvals for managers/admins
      if (isAdmin(currentUser) || isManager(currentUser)) {
        const pendingLeave = await LeaveRequest.filter({ status: 'pending' });
        const myApprovals = isAdmin(currentUser) 
          ? pendingLeave 
          : pendingLeave.filter(r => r.manager_id === currentEmp?.id);
        
        // Debug log for pending approvals
        console.log("DASHBOARD LEAVE DEBUG", {
          widget: "pendingApprovals",
          isAdmin: isAdmin(currentUser),
          currentEmployeeId: currentEmp?.id,
          totalPending: pendingLeave.length,
          myApprovalsCount: myApprovals.length,
          items: myApprovals.map(r => ({
            id: r.id,
            employee_id: r.employee_id,
            manager_id: r.manager_id,
            status: r.status,
            start_date: r.start_date,
            end_date: r.end_date,
          })),
        });
        
        myApprovals.forEach(req => {
          const emp = employees.find(e => e.id === req.employee_id);
          todoItems.push({
            id: `leave-${req.id}`,
            type: 'leave',
            icon: Calendar,
            title: `Leave request from ${emp ? getDisplayFirstName(emp) : 'Employee'}`,
            subtitle: `${req.total_days} days`,
            link: createPageUrl('LeaveApprovals'),
            color: 'text-blue-600 bg-blue-50',
          });
        });
      }

      // Onboarding tasks for managers
      if (isAdmin(currentUser) || isManager(currentUser)) {
        const instances = await OnboardingInstance.filter({ status: 'active' });
        for (const inst of instances) {
          const emp = employees.find(e => e.id === inst.employee_id);
          if (isAdmin(currentUser) || emp?.manager_id === currentEmp?.id) {
            const tasks = await OnboardingTask.filter({ 
              instance_id: inst.id, 
              status: 'not_started' 
            });
            const managerTasks = tasks.filter(t => t.assigned_to_role === 'MANAGER' || isAdmin(currentUser));
            if (managerTasks.length > 0) {
              todoItems.push({
                id: `onboard-${inst.id}`,
                type: 'onboarding',
                icon: UserPlus,
                title: `Onboarding tasks for ${emp ? getDisplayFirstName(emp) : 'New hire'}`,
                subtitle: `${managerTasks.length} pending`,
                link: createPageUrl('OnboardingDetail') + `?id=${inst.id}`,
                color: 'text-green-600 bg-green-50',
              });
            }
          }
        }
      }

      // Offboarding tasks for managers/HR
      if (isAdmin(currentUser) || isManager(currentUser)) {
        const offInstances = await OffboardingInstance.filter({ status: 'in_progress' });
        for (const inst of offInstances) {
          const emp = employees.find(e => e.id === inst.employee_id);
          if (isAdmin(currentUser) || emp?.manager_id === currentEmp?.id) {
            const tasks = await OffboardingTask.filter({ 
              instance_id: inst.id, 
              status: 'not_started' 
            });
            if (tasks.length > 0) {
              todoItems.push({
                id: `offboard-${inst.id}`,
                type: 'offboarding',
                icon: UserMinus,
                title: `Offboarding tasks for ${emp ? getDisplayFirstName(emp) : 'Employee'}`,
                subtitle: `${tasks.length} pending`,
                link: createPageUrl('Offboarding'),
                color: 'text-orange-600 bg-orange-50',
              });
            }
          }
        }
      }

      setTodos(todoItems);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      onboarding: 'bg-blue-100 text-blue-700',
      offboarding: 'bg-orange-100 text-orange-700',
      on_leave: 'bg-purple-100 text-purple-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const quickLinks = [
    { label: 'Employee Directory', icon: Users, page: 'Employees', color: 'from-blue-500 to-blue-600' },
    { label: 'Org Chart', icon: Network, page: 'OrgChart', color: 'from-indigo-500 to-indigo-600' },
    { label: 'Leave', icon: Calendar, page: 'MyLeave', color: 'from-green-500 to-green-600' },
    { label: 'Settings', icon: Settings, page: 'Dashboard', color: 'from-gray-500 to-gray-600', adminOnly: true },
  ];

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
        <p className="text-gray-500 mt-1">Here's what's happening today</p>
      </div>

      {/* Upcoming Time Off & Holidays */}
      {employee && (
        <UpcomingTimeOffCard 
          employee={employee}
          isManager={isAdmin(user) || isManager(user)}
          directReports={directReports}
        />
      )}

      {/* To-Do Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-indigo-600" />
            Your To-Do List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-gray-500">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>You're all caught up!</span>
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map(todo => (
                <Link 
                  key={todo.id}
                  to={todo.link}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group"
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${todo.color}`}>
                    <todo.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{todo.title}</p>
                    <p className="text-sm text-gray-500">{todo.subtitle}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your Team Section */}
      {directReports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-indigo-600" />
              Your Team
              <Badge variant="secondary" className="ml-2">{directReports.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {directReports.map(report => (
                <Link
                  key={report.id}
                  to={createPageUrl('EmployeeProfile') + `?id=${report.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                    {getInitials(report)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {getDisplayName(report)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Briefcase className="h-3 w-3" />
                      <span className="truncate">{report.job_title || 'No role'}</span>
                    </div>
                    {locations[report.location_id] && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{locations[report.location_id]}</span>
                      </div>
                    )}
                  </div>
                  <Badge className={getStatusBadge(report.status)}>
                    {report.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickLinks
            .filter(link => !link.adminOnly || isAdmin(user))
            .map(link => (
              <Link
                key={link.page}
                to={createPageUrl(link.page)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border bg-white hover:shadow-md transition-all group"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <link.icon className="h-6 w-6 text-white" />
                </div>
                <span className="font-medium text-gray-700 text-center text-sm">{link.label}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}