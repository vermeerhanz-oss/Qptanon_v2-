import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  User, 
  Briefcase, 
  MapPin, 
  Building2,
  FileText,
  Activity,
  DollarSign,
  Loader2,
  Shield,
  UserMinus,
  UserPlus,
  Clock,
  Mail,
  Calendar
} from 'lucide-react';
import { canActOnEmployee, canActAsAdmin, canManageOffboarding, isSensitiveFieldVisible } from '@/components/utils/permissions';
import StartOffboardingWizard from '@/components/offboarding/StartOffboardingWizard';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import ProfilePersonalSection from '@/components/employee-profile/ProfilePersonalSection';
import ProfileWorkSection from '@/components/employee-profile/ProfileWorkSection';
import ProfileCompensationSection from '@/components/employee-profile/ProfileCompensationSection';
import ProfileLocationSection from '@/components/employee-profile/ProfileLocationSection';
import ProfileEntitySection from '@/components/employee-profile/ProfileEntitySection';
import ProfileDocumentsSection from '@/components/employee-profile/ProfileDocumentsSection';
import ProfileActivitySection from '@/components/employee-profile/ProfileActivitySection';
import ProfileLeaveSection from '@/components/employee-profile/ProfileLeaveSection';
import ProfileTimelineSection from '@/components/employee-profile/ProfileTimelineSection';
import ProfileGoogleSection from '@/components/employee-profile/ProfileGoogleSection';
import ProfileOnboardingSection from '@/components/employee-profile/ProfileOnboardingSection';
import ProfilePoliciesSection from '@/components/employee-profile/ProfilePoliciesSection';

const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;
const Department = base44.entities.Department;
const Location = base44.entities.Location;
const UserPreferences = base44.entities.UserPreferences;
const Document = base44.entities.Document;

export default function EmployeeProfile() {
  const [employee, setEmployee] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [entity, setEntity] = useState(null);
  const [department, setDepartment] = useState(null);
  const [location, setLocation] = useState(null);
  const [manager, setManager] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [editPermission, setEditPermission] = useState(false);
  const [canViewSensitive, setCanViewSensitive] = useState(false);
  const [canOffboard, setCanOffboard] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('personal');
  const [showOffboardingWizard, setShowOffboardingWizard] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [isManagerOfEmployee, setIsManagerOfEmployee] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const employeeId = urlParams.get('id');
  const tabFromUrl = urlParams.get('tab');

  useEffect(() => {
    if (employeeId) {
      loadData();
    }
  }, [employeeId]);

  // Set active tab from URL query param if present
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Load user preferences
      const prefs = await UserPreferences.filter({ user_id: user.id });
      const userPrefs = prefs[0] || { acting_mode: 'admin' };
      setPreferences(userPrefs);

      // Get current user's employee record
      const emps = await Employee.list();
      setAllEmployees(emps);
      const userEmployee = emps.find(e => e.email === user.email || e.user_id === user.id);
      setCurrentEmployee(userEmployee);

      // Get target employee
      const targetEmployee = emps.find(e => e.id === employeeId);
      if (!targetEmployee) {
        setIsLoading(false);
        return;
      }
      setEmployee(targetEmployee);

      // Check permissions using canActOnEmployee
      const canViewResult = canActOnEmployee(employeeId, user, userEmployee, userPrefs);
      setCanView(canViewResult);

      // Edit permission: admin mode = full edit, staff mode = self only
      const editResult = canActOnEmployee(employeeId, user, userEmployee, userPrefs);
      setEditPermission(editResult);

      // Sensitive field permission (salary, bonus, equity, etc.)
      setCanViewSensitive(isSensitiveFieldVisible(user, userPrefs));

      // Offboarding permission
      setCanOffboard(canManageOffboarding(user, userEmployee, userPrefs, false));

      // Load related data
      const [entities, departments, locations] = await Promise.all([
        targetEmployee.entity_id ? CompanyEntity.filter({ id: targetEmployee.entity_id }) : [],
        targetEmployee.department_id ? Department.filter({ id: targetEmployee.department_id }) : [],
        targetEmployee.location_id ? Location.filter({ id: targetEmployee.location_id }) : [],
      ]);

      setEntity(entities[0] || null);
      setDepartment(departments[0] || null);
      setLocation(locations[0] || null);

      if (targetEmployee.manager_id) {
        const mgr = emps.find(e => e.id === targetEmployee.manager_id);
        setManager(mgr || null);
      }

      // Check if current user is manager of this employee
      setIsManagerOfEmployee(userEmployee && targetEmployee.manager_id === userEmployee.id);

      // Load document count for tab label
      const docs = await Document.filter({ owner_employee_id: employeeId });
      setDocumentCount(docs.length);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeUpdate = async (updates) => {
    await Employee.update(employee.id, updates);
    await loadData();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'onboarding': return 'bg-blue-100 text-blue-700';
      case 'offboarding': return 'bg-orange-100 text-orange-700';
      case 'terminated': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Employee not found</p>
        <Link to={createPageUrl('Employees')}>
          <Button variant="outline" className="mt-4">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">You don't have permission to view this profile</p>
        <Link to={createPageUrl('Employees')}>
          <Button variant="outline" className="mt-4">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  const handleOffboardingSuccess = (offboarding) => {
    window.location.href = createPageUrl('OffboardingManage') + `?id=${offboarding.id}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={createPageUrl('Employees')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {getInitials(employee)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {getDisplayName(employee)}
                </h1>
                <Badge className={getStatusColor(employee.status)}>
                  {employee.status}
                </Badge>
              </div>
              <p className="text-gray-500">{employee.job_title}</p>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                {department && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {department.name}
                  </span>
                )}
                {entity && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {entity.abbreviation || entity.name}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {location.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Offboarding button */}
        {canOffboard && employee.status === 'active' && (
          <Button 
            variant="outline" 
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setShowOffboardingWizard(true)}
          >
            <UserMinus className="h-4 w-4 mr-2" />
            Start Offboarding
          </Button>
        )}

        {manager && (
          <Card className="w-64 flex-shrink-0">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-2">Reports to</p>
              <Link 
                to={createPageUrl('EmployeeProfile') + `?id=${manager.id}`}
                className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 -m-2"
              >
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                  {getInitials(manager)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {getDisplayName(manager)}
                  </p>
                  <p className="text-xs text-gray-500">{manager.job_title}</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="work" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Work & Reporting
          </TabsTrigger>
          {canViewSensitive && (
            <TabsTrigger value="compensation" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Compensation
            </TabsTrigger>
          )}
          <TabsTrigger value="location" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="entity" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Entity
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents {documentCount > 0 && `(${documentCount})`}
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
          <ProfilePersonalSection 
            employee={employee}
            canEdit={editPermission}
            onUpdate={handleEmployeeUpdate}
          />
        </TabsContent>

        <TabsContent value="work" className="mt-6">
          <ProfileWorkSection 
            employee={employee}
            manager={manager}
            department={department}
            canEdit={editPermission}
            onUpdate={handleEmployeeUpdate}
          />
        </TabsContent>

        {canViewSensitive && (
          <TabsContent value="compensation" className="mt-6">
            <ProfileCompensationSection 
              employee={employee}
              canEdit={editPermission}
              canViewSensitive={canViewSensitive}
              onUpdate={handleEmployeeUpdate}
            />
          </TabsContent>
        )}

        <TabsContent value="location" className="mt-6">
          <ProfileLocationSection 
            employee={employee}
            location={location}
            canEdit={editPermission}
            onUpdate={handleEmployeeUpdate}
          />
        </TabsContent>

        <TabsContent value="entity" className="mt-6">
          <ProfileEntitySection 
            employee={employee}
            entity={entity}
            canEdit={editPermission}
            onUpdate={handleEmployeeUpdate}
          />
        </TabsContent>

        <TabsContent value="leave" className="mt-6">
          <ProfileLeaveSection employee={employee} />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <ProfileOnboardingSection employee={employee} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <ProfileDocumentsSection 
            employee={employee}
            canEdit={editPermission}
            currentUser={currentUser}
            currentEmployee={currentEmployee}
            isAdmin={canActAsAdmin(currentUser, preferences)}
            isManagerOfEmployee={isManagerOfEmployee}
          />
        </TabsContent>

        <TabsContent value="policies" className="mt-6">
          <ProfilePoliciesSection employee={employee} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <ProfileTimelineSection 
            employee={employee}
            viewerRole={
              canActAsAdmin(currentUser, preferences) ? 'admin' :
              isManagerOfEmployee ? 'manager' : 'staff'
            }
          />
        </TabsContent>

        <TabsContent value="google" className="mt-6">
          <ProfileGoogleSection 
            employee={employee}
            canEdit={canActAsAdmin(currentUser, preferences)}
            onUpdate={loadData}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ProfileActivitySection 
            employee={employee}
          />
        </TabsContent>
      </Tabs>

      {/* Offboarding Wizard */}
      <StartOffboardingWizard
        open={showOffboardingWizard}
        onOpenChange={setShowOffboardingWizard}
        preselectedEmployee={employee}
        employees={allEmployees}
        onSuccess={handleOffboardingSuccess}
      />
    </div>
  );
}