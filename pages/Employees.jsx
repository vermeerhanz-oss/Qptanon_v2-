import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Plus, Upload, List, GitBranch } from 'lucide-react';
import { EmployeeFilters } from '../components/employees/EmployeeFilters';
import { EmployeeTable } from '../components/employees/EmployeeTable';
import { EmployeeTreeTable } from '../components/employees/EmployeeTreeTable';
import { EmployeeImportWizard } from '../components/employees/EmployeeImportWizard';
import { canActAsAdmin, canViewEmployee } from '@/components/utils/permissions';
import { cn } from "@/lib/utils";

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;
const UserPreferences = base44.entities.UserPreferences;

export default function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [locationId, setLocationId] = useState('all');
  const [status, setStatus] = useState('all');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [viewMode, setViewMode] = useState('hierarchy'); // 'hierarchy' | 'flat'

  useEffect(() => {
    const loadData = async () => {
      try {
        const [emps, depts, locs, currentUser] = await Promise.all([
          Employee.list(),
          Department.list(),
          Location.list(),
          base44.auth.me(),
        ]);
        setEmployees(emps);
        setDepartments(depts);
        setLocations(locs);
        setUser(currentUser);
        
        // Load user preferences
        const prefs = await UserPreferences.filter({ user_id: currentUser.id });
        setPreferences(prefs[0] || { acting_mode: 'admin' });
        
        const currEmp = emps.find(e => e.email === currentUser.email);
        setCurrentEmployee(currEmp || null);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // For flat view, apply filters directly
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (!canViewEmployee(user, emp, currentEmployee, preferences)) return false;
      
      const searchMatch = !search || 
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        emp.email?.toLowerCase().includes(search.toLowerCase());
      const deptMatch = departmentId === 'all' || emp.department_id === departmentId;
      const locMatch = locationId === 'all' || emp.location_id === locationId;
      const statusMatch = status === 'all' || emp.status === status;
      return searchMatch && deptMatch && locMatch && statusMatch;
    });
  }, [employees, search, departmentId, locationId, status, user, currentEmployee, preferences]);

  // For hierarchy view, pass all employees and let tree table handle filtering
  const visibleEmployees = useMemo(() => {
    return employees.filter(emp => canViewEmployee(user, emp, currentEmployee, preferences));
  }, [employees, user, currentEmployee, preferences]);
  
  const userIsAdmin = canActAsAdmin(user, preferences);

  const handleRowClick = (employee) => {
    navigate(createPageUrl('EmployeeProfile') + `?id=${employee.id}`);
  };

  const handleImportComplete = async () => {
    const [emps, depts, locs] = await Promise.all([
      Employee.list(),
      Department.list(),
      Location.list(),
    ]);
    setEmployees(emps);
    setDepartments(depts);
    setLocations(locs);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">People</h1>
          <p className="text-slate-500 mt-1">
            {viewMode === 'flat' ? filteredEmployees.length : visibleEmployees.length} employees
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === 'hierarchy' 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <GitBranch className="h-4 w-4" />
              Hierarchy
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                viewMode === 'flat' 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <List className="h-4 w-4" />
              Flat
            </button>
          </div>

          {userIsAdmin && (
            <>
              <Button variant="outline" onClick={() => setShowImportWizard(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
              <Button onClick={() => navigate(createPageUrl('EmployeeProfile') + '?new=true')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </>
          )}
        </div>
      </div>

      {showImportWizard && (
        <EmployeeImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={handleImportComplete}
        />
      )}

      <EmployeeFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        locationId={locationId}
        onLocationChange={setLocationId}
        status={status}
        onStatusChange={setStatus}
        departments={departments}
        locations={locations}
      />

      {viewMode === 'hierarchy' ? (
        <EmployeeTreeTable
          employees={visibleEmployees}
          departments={departments}
          locations={locations}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          search={search}
          filters={{ departmentId, locationId, status }}
        />
      ) : (
        <EmployeeTable
          employees={filteredEmployees}
          departments={departments}
          locations={locations}
          isLoading={isLoading}
          onRowClick={handleRowClick}
        />
      )}
    </div>
  );
}