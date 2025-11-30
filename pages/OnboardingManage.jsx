import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, Search, Users, Clock, CheckCircle2, AlertCircle, ArrowRight, 
  Loader2, Calendar, Trash2, UserPlus, AlertTriangle, ArrowUpDown,
  CalendarDays, TrendingUp
} from 'lucide-react';
import { format, parseISO, isBefore, addDays, startOfToday, subDays, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { getOnboardingProgress, completeTask } from '@/components/onboarding/onboardingEngine';
import StartOnboardingModal2 from '@/components/onboarding/StartOnboardingModal2';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import OnboardingTaskCard, { getTaskUrgency } from '@/components/onboarding/OnboardingTaskCard';
import OnboardingProgressRing from '@/components/onboarding/OnboardingProgressRing';

const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const EmployeeOnboardingTask = base44.entities.EmployeeOnboardingTask;
const OnboardingTemplate = base44.entities.OnboardingTemplate;
const Employee = base44.entities.Employee;

export default function OnboardingManage() {
  const [onboardings, setOnboardings] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedOnboarding, setSelectedOnboarding] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      
      if (!ctx.permissions?.canManageOnboarding) {
        window.location.href = createPageUrl('Home');
        return;
      }

      const [onboardingsData, employeesData, templatesData, tasksData] = await Promise.all([
        EmployeeOnboarding.list('-created_date'),
        Employee.list(),
        OnboardingTemplate.list(),
        EmployeeOnboardingTask.list(),
      ]);

      setOnboardings(onboardingsData);
      setEmployees(employeesData);
      setTemplates(templatesData);
      setAllTasks(tasksData);

      // Load progress for each onboarding
      const progressPromises = onboardingsData.map(async (onb) => {
        const progress = await getOnboardingProgress(onb.id);
        return { id: onb.id, progress };
      });
      const progressResults = await Promise.all(progressPromises);
      const progressObj = {};
      progressResults.forEach(({ id, progress }) => {
        progressObj[id] = progress;
      });
      setProgressMap(progressObj);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEmployee = (id) => employees.find(e => e.id === id);
  const getTemplate = (id) => templates.find(t => t.id === id);

  // Calculate statistics
  const stats = useMemo(() => {
    const today = startOfToday();
    const weekFromNow = addDays(today, 7);
    const weekAgo = subDays(today, 7);

    const activeOnboardings = onboardings.filter(o => o.status !== 'completed');
    const completedRecently = onboardings.filter(o => 
      o.status === 'completed' && 
      o.completed_at && 
      isWithinInterval(parseISO(o.completed_at), { start: weekAgo, end: today })
    );

    const startingThisWeek = onboardings.filter(o => 
      o.start_date && 
      isWithinInterval(parseISO(o.start_date), { start: today, end: weekFromNow })
    );

    // Count overdue tasks across all active onboardings
    let overdueTaskCount = 0;
    const activeOnboardingIds = new Set(activeOnboardings.map(o => o.id));
    allTasks.forEach(task => {
      if (!activeOnboardingIds.has(task.onboarding_id)) return;
      if (task.status === 'completed') return;
      if (task.due_date && isBefore(parseISO(task.due_date), today)) {
        overdueTaskCount++;
      }
    });

    return {
      active: activeOnboardings.length,
      overdueTasks: overdueTaskCount,
      startingThisWeek: startingThisWeek.length,
      completedRecently: completedRecently.length,
    };
  }, [onboardings, allTasks]);

  // Calculate overdue count per onboarding
  const getOverdueCount = (onboardingId) => {
    const today = startOfToday();
    return allTasks.filter(t => 
      t.onboarding_id === onboardingId && 
      t.status !== 'completed' && 
      t.due_date && 
      isBefore(parseISO(t.due_date), today)
    ).length;
  };

  // Filter and sort onboardings
  const filteredOnboardings = useMemo(() => {
    let result = onboardings.filter(onb => {
      const employee = getEmployee(onb.employee_id);
      if (!employee) return false;
      
      // Status filter
      if (statusFilter !== 'all' && onb.status !== statusFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
        const templateName = getTemplate(onb.template_id)?.name?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        if (!fullName.includes(query) && !templateName.includes(query)) return false;
      }
      
      return true;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name': {
          const empA = getEmployee(a.employee_id);
          const empB = getEmployee(b.employee_id);
          const nameA = empA ? `${empA.first_name} ${empA.last_name}` : '';
          const nameB = empB ? `${empB.first_name} ${empB.last_name}` : '';
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'start_date':
          comparison = (a.start_date || '').localeCompare(b.start_date || '');
          break;
        case 'progress':
          comparison = (progressMap[a.id]?.percentage || 0) - (progressMap[b.id]?.percentage || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [onboardings, statusFilter, searchQuery, sortBy, sortOrder, employees, templates, progressMap]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleViewOnboarding = async (onboarding) => {
    setSelectedOnboarding(onboarding);
    setLoadingTasks(true);
    try {
      const tasks = await EmployeeOnboardingTask.filter({ onboarding_id: onboarding.id });
      tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setSelectedTasks(tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    setUpdatingTaskId(taskId);
    try {
      await completeTask(taskId);
      
      setSelectedTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'completed', completed_at: new Date().toISOString() }
          : t
      ));

      // Update allTasks for stats
      setAllTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'completed', completed_at: new Date().toISOString() }
          : t
      ));

      if (selectedOnboarding) {
        const prog = await getOnboardingProgress(selectedOnboarding.id);
        setProgressMap(prev => ({ ...prev, [selectedOnboarding.id]: prog }));
      }

      toast.success('Task marked complete.');
    } catch (error) {
      toast.error('Failed to update task.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Remove this task from the onboarding plan?')) return;
    
    try {
      await EmployeeOnboardingTask.delete(taskId);
      setSelectedTasks(prev => prev.filter(t => t.id !== taskId));
      setAllTasks(prev => prev.filter(t => t.id !== taskId));
      
      if (selectedOnboarding) {
        const prog = await getOnboardingProgress(selectedOnboarding.id);
        setProgressMap(prev => ({ ...prev, [selectedOnboarding.id]: prog }));
      }
      
      toast.success('Task removed.');
    } catch (error) {
      toast.error('Failed to remove task.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'not_started':
        return <Badge className="bg-gray-100 text-gray-700">Not Started</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-700">Paused</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>;
    }
  };

  // Group tasks by urgency for detail view
  const groupedTasks = useMemo(() => {
    const groups = { overdue: [], due_soon: [], upcoming: [], completed: [] };
    
    selectedTasks.forEach(task => {
      const urgency = getTaskUrgency(task);
      if (urgency === 'completed') {
        groups.completed.push(task);
      } else if (urgency === 'overdue') {
        groups.overdue.push(task);
      } else if (urgency === 'due_today' || urgency === 'due_soon') {
        groups.due_soon.push(task);
      } else {
        groups.upcoming.push(task);
      }
    });

    return groups;
  }, [selectedTasks]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Management</h1>
          <p className="text-gray-500 mt-1">Track and manage employee onboarding</p>
        </div>
        <div className="flex gap-3">
          <Link to={createPageUrl('NewHireOnboardingWizard')}>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Onboard New Hire
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.overdueTasks > 0 ? 'border-red-200' : ''}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stats.overdueTasks > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <AlertTriangle className={`h-6 w-6 ${stats.overdueTasks > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.overdueTasks}</p>
              <p className="text-sm text-gray-500">Overdue Tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.startingThisWeek}</p>
              <p className="text-sm text-gray-500">Starting This Week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.completedRecently}</p>
              <p className="text-sm text-gray-500">Completed (7d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by employee or template..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Onboarding Table */}
      <Card>
        <CardContent className="p-0">
          {filteredOnboardings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No onboarding records found</p>
              <Link to={createPageUrl('NewHireOnboardingWizard')}>
                <Button variant="outline" className="mt-4">
                  Onboard New Hire
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b text-sm font-medium text-gray-600">
                <button 
                  onClick={() => toggleSort('name')}
                  className="col-span-4 flex items-center gap-1 hover:text-gray-900"
                >
                  Employee
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <div className="col-span-2">Template</div>
                <button 
                  onClick={() => toggleSort('start_date')}
                  className="col-span-2 flex items-center gap-1 hover:text-gray-900"
                >
                  Start Date
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <button 
                  onClick={() => toggleSort('progress')}
                  className="col-span-2 flex items-center gap-1 hover:text-gray-900"
                >
                  Progress
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <div className="col-span-2 text-right">Status</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-gray-100">
                {filteredOnboardings.map(onb => {
                  const employee = getEmployee(onb.employee_id);
                  const template = getTemplate(onb.template_id);
                  const progress = progressMap[onb.id] || { percentage: 0, completed: 0, total: 0 };
                  const overdueCount = getOverdueCount(onb.id);

                  return (
                    <div 
                      key={onb.id} 
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 md:px-6 hover:bg-gray-50 transition-colors cursor-pointer items-center"
                      onClick={() => handleViewOnboarding(onb)}
                    >
                      {/* Employee */}
                      <div className="md:col-span-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium flex-shrink-0 text-sm">
                          {employee ? getInitials(employee) : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {employee ? getDisplayName(employee) : 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500 truncate">{employee?.job_title || 'No role'}</p>
                        </div>
                      </div>

                      {/* Template */}
                      <div className="md:col-span-2 text-sm text-gray-600 truncate">
                        {template?.name || '—'}
                      </div>

                      {/* Start Date */}
                      <div className="md:col-span-2 text-sm text-gray-600">
                        {onb.start_date ? format(parseISO(onb.start_date), 'MMM d, yyyy') : '—'}
                      </div>

                      {/* Progress */}
                      <div className="md:col-span-2">
                        <div className="flex items-center gap-2">
                          <Progress value={progress.percentage} className="h-2 flex-1" />
                          <span className="text-sm font-medium w-10 text-right">{progress.percentage}%</span>
                        </div>
                        {overdueCount > 0 && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {overdueCount} overdue
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2 flex items-center justify-end gap-2">
                        {getStatusBadge(onb.status)}
                        <ArrowRight className="h-4 w-4 text-gray-400 hidden md:block" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Start Onboarding Modal */}
      <StartOnboardingModal2
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSuccess={loadData}
      />

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedOnboarding} onOpenChange={(open) => !open && setSelectedOnboarding(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedOnboarding && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <OnboardingProgressRing 
                    percentage={progressMap[selectedOnboarding.id]?.percentage || 0} 
                    size={48} 
                    strokeWidth={4} 
                  />
                  <div>
                    <span>{getEmployee(selectedOnboarding.employee_id) 
                      ? getDisplayName(getEmployee(selectedOnboarding.employee_id)) 
                      : 'Unknown'}</span>
                    <p className="text-sm font-normal text-gray-500">
                      {getTemplate(selectedOnboarding.template_id)?.name || 'Onboarding Plan'}
                      {selectedOnboarding.start_date && ` • Started ${format(parseISO(selectedOnboarding.start_date), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {loadingTasks ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  </div>
                ) : selectedTasks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tasks in this onboarding plan</p>
                ) : (
                  <>
                    {/* Overdue */}
                    {groupedTasks.overdue.length > 0 && (
                      <TaskGroup
                        title="Overdue"
                        icon={AlertTriangle}
                        iconColor="text-red-500"
                        tasks={groupedTasks.overdue}
                        onComplete={handleCompleteTask}
                        onDelete={handleDeleteTask}
                        updatingTaskId={updatingTaskId}
                      />
                    )}

                    {/* Due Soon */}
                    {groupedTasks.due_soon.length > 0 && (
                      <TaskGroup
                        title="Due Soon"
                        icon={Clock}
                        iconColor="text-amber-500"
                        tasks={groupedTasks.due_soon}
                        onComplete={handleCompleteTask}
                        onDelete={handleDeleteTask}
                        updatingTaskId={updatingTaskId}
                      />
                    )}

                    {/* Upcoming */}
                    {groupedTasks.upcoming.length > 0 && (
                      <TaskGroup
                        title="Upcoming"
                        icon={Calendar}
                        iconColor="text-blue-500"
                        tasks={groupedTasks.upcoming}
                        onComplete={handleCompleteTask}
                        onDelete={handleDeleteTask}
                        updatingTaskId={updatingTaskId}
                      />
                    )}

                    {/* Completed */}
                    {groupedTasks.completed.length > 0 && (
                      <TaskGroup
                        title="Completed"
                        icon={CheckCircle2}
                        iconColor="text-green-500"
                        tasks={groupedTasks.completed}
                        onDelete={handleDeleteTask}
                        collapsed
                      />
                    )}
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedOnboarding(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskGroup({ title, icon: Icon, iconColor, tasks, onComplete, onDelete, updatingTaskId, collapsed = false }) {
  const [isOpen, setIsOpen] = React.useState(!collapsed);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {title}
        <Badge variant="outline" className="text-xs">{tasks.length}</Badge>
      </button>
      {isOpen && (
        <div className="space-y-2 ml-6">
          {tasks.map(task => (
            <div key={task.id} className="flex items-start gap-2">
              <OnboardingTaskCard
                task={task}
                onComplete={onComplete}
                isUpdating={updatingTaskId === task.id}
                showAssignee
                compact
              />
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 flex-shrink-0 mt-2"
                  onClick={() => onDelete(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}