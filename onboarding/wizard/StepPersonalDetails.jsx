import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Briefcase, MapPin } from 'lucide-react';

export default function StepPersonalDetails({
  data,
  onChange,
  errors = {},
  employees = [],
  departments = [],
  locations = [],
}) {
  const personal = data.personal || {};

  const updatePersonal = (field, value) => {
    onChange({
      ...data,
      personal: { ...personal, [field]: value },
    });
  };

  // Filter active employees for manager dropdown
  const activeEmployees = employees.filter(e => e.status === 'active');

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </div>
          <CardDescription>Basic details about the new hire</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={personal.first_name || ''}
                onChange={(e) => updatePersonal('first_name', e.target.value)}
                placeholder="Enter first name"
                className={errors.first_name ? 'border-red-500' : ''}
              />
              {errors.first_name && (
                <p className="text-sm text-red-500 mt-1">{errors.first_name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={personal.last_name || ''}
                onChange={(e) => updatePersonal('last_name', e.target.value)}
                placeholder="Enter last name"
                className={errors.last_name ? 'border-red-500' : ''}
              />
              {errors.last_name && (
                <p className="text-sm text-red-500 mt-1">{errors.last_name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="personal_email">Personal Email</Label>
              <Input
                id="personal_email"
                type="email"
                value={personal.personal_email || ''}
                onChange={(e) => updatePersonal('personal_email', e.target.value)}
                placeholder="personal@email.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for contract delivery before work email is set up
              </p>
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={personal.phone || ''}
                onChange={(e) => updatePersonal('phone', e.target.value)}
                placeholder="+61 400 000 000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Role & Reporting</CardTitle>
          </div>
          <CardDescription>Job title, manager, and department</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job_title">Job Title *</Label>
              <Input
                id="job_title"
                value={personal.job_title || ''}
                onChange={(e) => updatePersonal('job_title', e.target.value)}
                placeholder="e.g. Software Engineer"
                className={errors.job_title ? 'border-red-500' : ''}
              />
              {errors.job_title && (
                <p className="text-sm text-red-500 mt-1">{errors.job_title}</p>
              )}
            </div>
            <div>
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={personal.start_date || ''}
                onChange={(e) => updatePersonal('start_date', e.target.value)}
                className={errors.start_date ? 'border-red-500' : ''}
              />
              {errors.start_date && (
                <p className="text-sm text-red-500 mt-1">{errors.start_date}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Manager</Label>
              <Select
                value={personal.manager_id || 'none'}
                onValueChange={(v) => updatePersonal('manager_id', v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {activeEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={personal.department_id || 'none'}
                onValueChange={(v) => updatePersonal('department_id', v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Office Location</CardTitle>
          </div>
          <CardDescription>Where will this person work?</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Office / Location</Label>
            <Select
              value={personal.location_id || 'none'}
              onValueChange={(v) => updatePersonal('location_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} {loc.state ? `(${loc.state})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}