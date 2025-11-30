import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import StartOnboardingModal2 from '@/components/onboarding/StartOnboardingModal2';
import { getOnboardingProgress } from '@/components/onboarding/onboardingAutomation';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';

const OnboardingInstance = base44.entities.OnboardingInstance;
const OnboardingTemplate = base44.entities.OnboardingTemplate;
const Employee = base44.entities.Employee;

export default function OnboardingDashboard() {
  const [instances, setInstances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      
      // Redirect if not authorized
      if (!ctx.permissions?.canManageOnboarding) {
        window.location.href = createPageUrl('Home');
        return;
      }

      const [instancesData, employeesData, templatesData] = await Promise.all([
        OnboardingInstance.list('-created_date'),
        Employee.list(),
        OnboardingTemplate.list(),
      ]);

      setInstances(instancesData);
      setEmployees(employeesData);
      setTemplates(templatesData);

      // Load progress for each instance
      const progressPromises = instancesData.map(async (inst) => {
        const progress = await getOnboardingProgress(inst.id);
        return { id: inst.id, progress };
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
  const getManager = (employeeId) => {
    const emp = getEmployee(employeeId);
    if (!emp?.manager_id) return null;
    return getEmployee(emp.manager_id);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Pending</Badge>;
      case 'active':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredInstances = instances.filter(inst => {
    const employee = getEmployee(inst.employee_id);
    if (!employee) return false;
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Stats
  const activeCount = instances.filter(i => i.status === 'active').length;
  const pendingCount = instances.filter(i => i.status === 'pending').length;
  const completedCount = instances.filter(i => i.status === 'completed').length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New onboarding</h1>
          <p className="text-gray-500 mt-1">Start and manage employee onboarding</p>
        </div>
        <div className="flex gap-3">
          <Link to={createPageUrl('OnboardingTemplatesSettings')}>
            <Button variant="outline">Manage Templates</Button>
          </Link>
          <Button onClick={() => setShowStartModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Start Onboarding
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by employee name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Instances List */}
      <Card>
        <CardContent className="p-0">
          {filteredInstances.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No onboarding instances found</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowStartModal(true)}
              >
                Start First Onboarding
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredInstances.map(inst => {
                const employee = getEmployee(inst.employee_id);
                const template = getTemplate(inst.template_id);
                const manager = getManager(inst.employee_id);
                const progress = progressMap[inst.id] || { percentage: 0, completed: 0, total: 0 };

                return (
                  <Link 
                    key={inst.id} 
                    to={createPageUrl('OnboardingDetail') + `?id=${inst.id}`}
                    className="block hover:bg-gray-50 transition-colors"
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {employee?.first_name} {employee?.last_name}
                            </h3>
                            {getStatusBadge(inst.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span>{employee?.job_title}</span>
                            <span>•</span>
                            <span>Start: {format(new Date(inst.start_date), 'MMM d, yyyy')}</span>
                            {manager && (
                              <>
                                <span>•</span>
                                <span>Manager: {manager.first_name} {manager.last_name}</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{template?.name}</p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="w-32">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-500">Progress</span>
                              <span className="font-medium">{progress.percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  progress.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {progress.completed}/{progress.total} tasks
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <StartOnboardingModal2
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSuccess={loadData}
      />
    </div>
  );
}