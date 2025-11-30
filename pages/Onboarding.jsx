import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { isAfter, startOfMonth, differenceInDays, isPast, parseISO } from 'date-fns';
import { canActAsAdmin, isManager as checkIsManager } from '@/components/utils/permissions';
import { OnboardingStats } from '@/components/onboarding/OnboardingStats';
import { OnboardingTable } from '@/components/onboarding/OnboardingTable';
import { EmployeeOnboardingList } from '@/components/onboarding/EmployeeOnboardingList';
import { StartOnboardingModal } from '@/components/onboarding/StartOnboardingModal';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const OnboardingInstance = base44.entities.OnboardingInstance;
const OnboardingTask = base44.entities.OnboardingTask;
const UserPreferences = base44.entities.UserPreferences;

export default function Onboarding() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [instances, setInstances] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all_employees');
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingInstance, setCancellingInstance] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [showStartModal, setShowStartModal] = useState(false);
  const [startOnboardingEmployee, setStartOnboardingEmployee] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [currentUser, emps, depts, insts, allTasks] = await Promise.all([
        base44.auth.me(),
        Employee.list(),
        Department.list(),
        OnboardingInstance.list(),
        OnboardingTask.list(),
      ]);

      setUser(currentUser);
      
      // Load user preferences
      const prefs = await UserPreferences.filter({ user_id: currentUser.id });
      setPreferences(prefs[0] || { acting_mode: 'admin' });
      
      const currEmp = emps.find(e => e.email === currentUser.email);
      setCurrentEmployee(currEmp);
      setEmployees(emps);
      setDepartments(depts);
      setInstances(insts);
      setTasks(allTasks);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const userIsAdmin = canActAsAdmin(user, preferences);
  const userIsManager = checkIsManager(user);

  // Filter instances based on user role
  const filteredInstances = useMemo(() => {
    if (userIsAdmin) return instances;
    
    if (userIsManager && currentEmployee) {
      const directReportIds = employees
        .filter(e => e.manager_id === currentEmployee.id)
        .map(e => e.id);
      return instances.filter(i => directReportIds.includes(i.employee_id));
    }
    
    return [];
  }, [instances, employees, userIsAdmin, userIsManager, currentEmployee]);

  // Calculate stats
  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    
    const active = filteredInstances.filter(
      i => i.status === 'not_started' || i.status === 'in_progress'
    ).length;

    const completedThisMonth = filteredInstances.filter(
      i => i.status === 'completed' && i.updated_date && isAfter(new Date(i.updated_date), monthStart)
    ).length;

    // Count overdue tasks
    const activeInstanceIds = filteredInstances
      .filter(i => i.status === 'in_progress' || i.status === 'not_started')
      .map(i => i.id);
    
    const overdueTasks = tasks.filter(t => {
      if (!activeInstanceIds.includes(t.instance_id)) return false;
      if (t.status === 'done') return false;
      const instance = filteredInstances.find(i => i.id === t.instance_id);
      if (!instance?.due_date) return false;
      return isPast(parseISO(instance.due_date));
    }).length;

    // Calculate average completion time
    const completedInstances = filteredInstances.filter(i => i.status === 'completed');
    let avgCompletionDays = null;
    if (completedInstances.length > 0) {
      const totalDays = completedInstances.reduce((sum, inst) => {
        if (inst.created_date && inst.updated_date) {
          return sum + differenceInDays(new Date(inst.updated_date), new Date(inst.created_date));
        }
        return sum;
      }, 0);
      avgCompletionDays = Math.round(totalDays / completedInstances.length);
    }

    return { active, completedThisMonth, overdueTasks, avgCompletionDays };
  }, [filteredInstances, tasks]);

  // Categorize instances
  const categorizedInstances = useMemo(() => {
    const inProgress = filteredInstances.filter(i => 
      i.status === 'not_started' || i.status === 'in_progress'
    );
    const completed = filteredInstances.filter(i => i.status === 'completed');
    const cancelled = filteredInstances.filter(i => i.status === 'cancelled');

    return { inProgress, completed, cancelled };
  }, [filteredInstances]);

  const handleCancelClick = (instance) => {
    setCancellingInstance(instance);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingInstance) return;
    setIsCancelling(true);
    try {
      await OnboardingInstance.update(cancellingInstance.id, {
        status: 'cancelled',
        cancellation_reason: cancellationReason || null,
        cancelled_at: new Date().toISOString(),
      });
      
      setInstances(instances.map(i => 
        i.id === cancellingInstance.id 
          ? { ...i, status: 'cancelled', cancellation_reason: cancellationReason, cancelled_at: new Date().toISOString() }
          : i
      ));
      
      setShowCancelModal(false);
      setCancellingInstance(null);
      setCancellationReason('');
    } catch (err) {
      console.error('Error cancelling onboarding:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStartOnboarding = (employee) => {
    setStartOnboardingEmployee(employee);
    setShowStartModal(true);
  };

  const handleStartSuccess = () => {
    setShowStartModal(false);
    setStartOnboardingEmployee(null);
    loadData();
  };

  const tabs = [
    { id: 'all_employees', label: 'All Employees', count: employees.filter(e => e.status !== 'terminated').length },
    { id: 'in_progress', label: 'In Progress', count: categorizedInstances.inProgress.length },
    { id: 'completed', label: 'Completed', count: categorizedInstances.completed.length },
  ];

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'in_progress': return categorizedInstances.inProgress;
      case 'completed': return categorizedInstances.completed;
      default: return [];
    }
  };

  const filteredEmployees = useMemo(() => {
    if (userIsAdmin) return employees;
    if (userIsManager && currentEmployee) {
      return employees.filter(e => e.manager_id === currentEmployee.id);
    }
    return [];
  }, [employees, userIsAdmin, userIsManager, currentEmployee]);

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {userIsManager && !userIsAdmin ? 'Your direct reports' : 'Manage employee onboarding processes'}
        </p>
      </div>

      <OnboardingStats stats={stats} />

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'all_employees' ? (
        <EmployeeOnboardingList
          employees={filteredEmployees}
          instances={instances}
          departments={departments}
          tasks={tasks}
          isAdmin={userIsAdmin}
          onStartOnboarding={handleStartOnboarding}
        />
      ) : (
        <OnboardingTable
          items={getCurrentItems()}
          employees={employees}
          departments={departments}
          tasks={tasks}
          type={activeTab}
          onCancel={handleCancelClick}
          cancellingId={isCancelling ? cancellingInstance?.id : null}
          isAdmin={userIsAdmin}
        />
      )}

      {/* Start Onboarding Modal */}
      {showStartModal && startOnboardingEmployee && (
        <StartOnboardingModal
          employee={startOnboardingEmployee}
          onClose={() => {
            setShowStartModal(false);
            setStartOnboardingEmployee(null);
          }}
          onSuccess={handleStartSuccess}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cancel Onboarding</h2>
                <p className="text-sm text-gray-500">This will stop the onboarding process</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation Reason (optional)
              </label>
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => { 
                  setShowCancelModal(false); 
                  setCancellingInstance(null);
                  setCancellationReason(''); 
                }}
              >
                Keep Onboarding
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmCancel} 
                disabled={isCancelling}
              >
                {isCancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}