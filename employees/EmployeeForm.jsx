import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '../ui/Card';
import { Loader2 } from 'lucide-react';
import { findPotentialDuplicates, classifyDuplicateScenario } from '@/components/utils/employeeDuplicates';
import { DuplicateWarningPanel } from './DuplicateWarningPanel';
import debounce from 'lodash/debounce';
import { logForCurrentUser } from '@/components/utils/audit';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;

export function EmployeeForm() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Duplicate detection state
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [duplicateScenario, setDuplicateScenario] = useState('no_match');
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    preferred_name: '',
    email: '',
    personal_email: '',
    phone: '',
    job_title: '',
    department_id: '',
    location_id: '',
    manager_id: '',
    employment_type: 'full_time',
    status: 'active',
    start_date: '',
    end_date: '',
    notes: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [depts, locs, emps] = await Promise.all([
          Department.list(),
          Location.list(),
          Employee.list(),
        ]);
        setDepartments(depts);
        setLocations(locs);
        setEmployees(emps);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const checkDuplicates = useCallback(
    debounce(async (data) => {
      const { email, personal_email, phone, last_name } = data;
      
      // Only check if we have meaningful data
      if (!email && !personal_email && !(phone && last_name)) {
        setDuplicateMatches([]);
        setDuplicateScenario('no_match');
        return;
      }

      setIsCheckingDuplicates(true);
      try {
        const matches = await findPotentialDuplicates({
          email,
          personalEmail: personal_email,
          phone,
          lastName: last_name,
        });
        setDuplicateMatches(matches);
        setDuplicateScenario(classifyDuplicateScenario(data, matches));
        
        // Reset confirmation when matches change
        if (matches.length === 0) {
          setDuplicateConfirmed(false);
        }
      } catch (err) {
        console.error('Error checking duplicates:', err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500),
    []
  );

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    setError('');
    
    // Trigger duplicate check for relevant fields
    if (['email', 'personal_email', 'phone', 'last_name'].includes(field)) {
      checkDuplicates(newFormData);
    }
  };

  const handleFieldBlur = (field) => {
    if (['email', 'personal_email', 'phone', 'last_name'].includes(field)) {
      checkDuplicates(formData);
    }
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) return 'First name is required';
    if (!formData.last_name.trim()) return 'Last name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!formData.job_title.trim()) return 'Job title is required';
    if (!formData.department_id) return 'Department is required';
    if (!formData.start_date) return 'Start date is required';
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return 'Please enter a valid email address';
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Final server-side duplicate check
      const finalMatches = await findPotentialDuplicates({
        email: formData.email,
        personalEmail: formData.personal_email,
        phone: formData.phone,
        lastName: formData.last_name,
      });
      const finalScenario = classifyDuplicateScenario(formData, finalMatches);

      if (finalScenario === 'hard_match_active' && !duplicateConfirmed) {
        setError('This employee appears to already exist. Please review the potential duplicates and confirm before continuing.');
        setDuplicateMatches(finalMatches);
        setDuplicateScenario(finalScenario);
        setIsSubmitting(false);
        return;
      }
      // Build the data object, only including non-empty values
      const employeeData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        job_title: formData.job_title.trim(),
        department_id: formData.department_id,
        employment_type: formData.employment_type,
        status: formData.status,
        start_date: formData.start_date,
      };

      // Add optional fields only if they have values
      if (formData.preferred_name?.trim()) {
        employeeData.preferred_name = formData.preferred_name.trim();
      }
      if (formData.personal_email?.trim()) {
        employeeData.personal_email = formData.personal_email.trim();
      }
      if (formData.phone?.trim()) {
        employeeData.phone = formData.phone.trim();
      }
      if (formData.location_id) {
        employeeData.location_id = formData.location_id;
      }
      if (formData.manager_id) {
        employeeData.manager_id = formData.manager_id;
      }
      if (formData.end_date) {
        employeeData.end_date = formData.end_date;
      }
      if (formData.notes?.trim()) {
        employeeData.notes = formData.notes.trim();
      }

      const newEmployee = await Employee.create(employeeData);

      // Audit log
      await logForCurrentUser({
        eventType: 'employee_created',
        entityType: 'Employee',
        entityId: newEmployee.id,
        relatedEmployeeId: newEmployee.id,
        description: `Created employee ${newEmployee.first_name} ${newEmployee.last_name} (${newEmployee.email})`,
      });
      
      setSuccess('Employee created successfully!');
      
      // Redirect to the new employee's profile
      setTimeout(() => {
        navigate(createPageUrl('EmployeeProfile') + `?id=${newEmployee.id}`);
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicateMatches.length > 0 && (
        <div className="space-y-4">
          <DuplicateWarningPanel matches={duplicateMatches} scenario={duplicateScenario} />
          
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Checkbox
              id="duplicate-confirm"
              checked={duplicateConfirmed}
              onCheckedChange={setDuplicateConfirmed}
            />
            <label htmlFor="duplicate-confirm" className="text-sm text-gray-700 cursor-pointer">
              I have reviewed the potential duplicates and confirm this is a new employee.
            </label>
          </div>
        </div>
      )}

      {isCheckingDuplicates && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for duplicates...
        </div>
      )}

      {/* Personal Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                onBlur={() => handleFieldBlur('last_name')}
                placeholder="Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Name
              </label>
              <Input
                value={formData.preferred_name}
                onChange={(e) => handleChange('preferred_name', e.target.value)}
                placeholder="Johnny"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleFieldBlur('email')}
                placeholder="john.doe@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personal Email
              </label>
              <Input
                type="email"
                value={formData.personal_email}
                onChange={(e) => handleChange('personal_email', e.target.value)}
                onBlur={() => handleFieldBlur('personal_email')}
                placeholder="john@gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                onBlur={() => handleFieldBlur('phone')}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job & Organization Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job & Organization</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.job_title}
                onChange={(e) => handleChange('job_title', e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <Select value={formData.department_id} onValueChange={(v) => handleChange('department_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <Select value={formData.location_id} onValueChange={(v) => handleChange('location_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manager
              </label>
              <Select value={formData.manager_id} onValueChange={(v) => handleChange('manager_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Type
              </label>
              <Select value={formData.employment_type} onValueChange={(v) => handleChange('employment_type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional notes about this employee..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(createPageUrl('Employees'))}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isSubmitting ? 'Creating...' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}