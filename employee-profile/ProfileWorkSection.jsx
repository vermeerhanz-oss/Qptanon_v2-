import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pencil, Save, X, Loader2, Users, AlertTriangle, Crown, Star } from 'lucide-react';
import { format } from 'date-fns';
import { updateEmployeeWithTracking } from '@/components/automation/profileChangeEngine';
import { getValidManagerOptions, validateManagerAssignment } from '@/components/utils/managerValidation';
import { recalculateAllBalancesForEmployee } from '@/components/utils/leaveAccrual';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const CompanyEntity = base44.entities.CompanyEntity;
const LeavePolicy = base44.entities.LeavePolicy;
const EmploymentAgreement = base44.entities.EmploymentAgreement;

export default function ProfileWorkSection({ employee, manager, department, canEdit, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formData, setFormData] = useState({});
  const [departments, setDepartments] = useState([]);
  const [entities, setEntities] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [directReports, setDirectReports] = useState([]);
  const [leavePolicies, setLeavePolicies] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [managerWarning, setManagerWarning] = useState(null);
  const [serviceDateWarning, setServiceDateWarning] = useState(false);
  const [showRecalcPrompt, setShowRecalcPrompt] = useState(false);

  useEffect(() => {
    loadOptions();
    loadDirectReports();
  }, [employee]);

  const loadOptions = async () => {
    const [depts, ents, emps, policies, agrs] = await Promise.all([
      Department.list(),
      CompanyEntity.list(),
      Employee.list(),
      LeavePolicy.filter({ is_active: true }),
      EmploymentAgreement.filter({ is_active: true }),
    ]);
    setDepartments(depts);
    setEntities(ents);
    setAllEmployees(emps);
    setLeavePolicies(policies);
    setAgreements(agrs);
  };

  const loadDirectReports = async () => {
    const reports = await Employee.filter({ manager_id: employee.id });
    setDirectReports(reports);
  };

  // Compute valid managers based on current form values
  const { validManagers, groups, currentManagerWarning } = useMemo(() => {
    if (!isEditing || allEmployees.length === 0) {
      return { validManagers: [], groups: [], currentManagerWarning: null };
    }
    
    return getValidManagerOptions(
      { ...employee, ...formData },
      allEmployees,
      {
        entityId: formData.entity_id || employee.entity_id,
        departmentId: formData.department_id || employee.department_id,
      }
    );
  }, [isEditing, allEmployees, employee, formData.entity_id, formData.department_id]);

  useEffect(() => {
    if (currentManagerWarning) {
      setManagerWarning(currentManagerWarning.message);
    } else {
      setManagerWarning(null);
    }
  }, [currentManagerWarning]);

  const startEditing = () => {
    setFormData({
      job_title: employee.job_title || '',
      department_id: employee.department_id || '',
      entity_id: employee.entity_id || '',
      manager_id: employee.manager_id || '',
      employment_type: employee.employment_type || 'full_time',
      hours_per_week: employee.hours_per_week || '',
      employment_agreement_id: employee.employment_agreement_id || '',
      service_start_date: employee.service_start_date || employee.start_date || '',
      entity_start_date: employee.entity_start_date || employee.start_date || '',
      termination_date: employee.termination_date || '',
      status: employee.status || 'active',
      is_manager: employee.is_manager || false,
      is_department_head: employee.is_department_head || false,
      is_executive: employee.is_executive || false,
      annual_leave_policy_id: employee.annual_leave_policy_id || '',
      personal_leave_policy_id: employee.personal_leave_policy_id || '',
      long_service_leave_policy_id: employee.long_service_leave_policy_id || '',
    });
    setSaveError(null);
    setServiceDateWarning(false);
    setShowRecalcPrompt(false);
    setIsEditing(true);
  };

  // Filter policies by leave type
  const getPoliciesForType = (leaveType) => {
    return leavePolicies.filter(p => p.leave_type === leaveType);
  };

  const getPolicyName = (policyId) => {
    const policy = leavePolicies.find(p => p.id === policyId);
    return policy?.name || 'Default';
  };

  const getAgreementName = (agreementId) => {
    const agreement = agreements.find(a => a.id === agreementId);
    return agreement?.name || '';
  };

  const handleAgreementChange = (newAgreementId) => {
    setFormData(prev => ({ ...prev, employment_agreement_id: newAgreementId === 'none' ? '' : newAgreementId }));
    // Show recalc prompt if agreement changed from original
    if ((newAgreementId || '') !== (employee.employment_agreement_id || '')) {
      setShowRecalcPrompt(true);
    }
  };

  const handleDepartmentChange = (newDeptId) => {
    setFormData(prev => ({ ...prev, department_id: newDeptId }));
    
    // Check if current manager selection is still valid
    if (formData.manager_id) {
      const result = getValidManagerOptions(
        { ...employee, ...formData, department_id: newDeptId },
        allEmployees,
        { entityId: formData.entity_id || employee.entity_id, departmentId: newDeptId }
      );
      
      const stillValid = result.validManagers.some(m => m.id === formData.manager_id && !m.isInvalid);
      if (!stillValid) {
        const mgr = allEmployees.find(e => e.id === formData.manager_id);
        if (mgr && !mgr.is_executive && !mgr.is_department_head) {
          setManagerWarning('Current manager is outside the new department. Consider updating.');
        }
      } else {
        setManagerWarning(null);
      }
    }
  };

  const handleEntityChange = (newEntityId) => {
    setFormData(prev => ({ 
      ...prev, 
      entity_id: newEntityId,
      manager_id: '' // Clear manager when entity changes
    }));
    setManagerWarning('Manager has been cleared. Please select a manager from the new entity.');
  };

  const handleSave = async () => {
    if (canEdit !== true) return;
    
    setSaveError(null);
    
    // Validate manager assignment
    const validation = validateManagerAssignment(
      employee.id,
      formData.manager_id,
      formData.entity_id || employee.entity_id,
      allEmployees
    );
    
    if (!validation.valid) {
      setSaveError(validation.error);
      return;
    }
    
    setIsSaving(true);
    try {
      // Check if employment start date changed
      const oldStartDate = employee.service_start_date || employee.start_date;
      const newStartDate = formData.service_start_date;
      const startDateChanged = oldStartDate !== newStartDate && newStartDate;
      
      await updateEmployeeWithTracking(employee.id, formData);
      
      // Recalculate leave balances if employment start date changed
      if (startDateChanged) {
        console.log('Employment start date changed, recalculating leave balances...');
        await recalculateAllBalancesForEmployee(employee.id);
      }
      
      await onUpdate(formData);
      setIsEditing(false);
      setManagerWarning(null);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveError(error.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
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

  const getEmploymentTypeLabel = (type) => {
    const labels = {
      full_time: 'Full-time',
      part_time: 'Part-time',
      contractor: 'Contractor',
      casual: 'Casual',
    };
    return labels[type] || type;
  };

  const getDepartmentName = (deptId) => {
    return departments.find(d => d.id === deptId)?.name || '';
  };

  const getEntityName = (entId) => {
    const ent = entities.find(e => e.id === entId);
    return ent?.abbreviation || ent?.name || '';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Work & Reporting</h2>
          {canEdit === true && !isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setManagerWarning(null); setSaveError(null); setServiceDateWarning(false); }}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {saveError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        {managerWarning && isEditing && (
          <Alert className="mb-4 border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">{managerWarning}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Job Title */}
          <div>
            <Label className="text-xs text-gray-500">Job Title</Label>
            {isEditing ? (
              <Input
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-gray-900 mt-1">{employee.job_title || '—'}</p>
            )}
          </div>

          {/* Entity */}
          <div>
            <Label className="text-xs text-gray-500">Company Entity</Label>
            {isEditing ? (
              <Select 
                value={formData.entity_id} 
                onValueChange={handleEntityChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.abbreviation || e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">{getEntityName(employee.entity_id) || '—'}</p>
            )}
          </div>

          {/* Department */}
          <div>
            <Label className="text-xs text-gray-500">Department</Label>
            {isEditing ? (
              <Select 
                value={formData.department_id} 
                onValueChange={handleDepartmentChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">{department?.name || '—'}</p>
            )}
          </div>

          {/* Manager - Smart Dropdown */}
          <div>
            <Label className="text-xs text-gray-500">Reports To</Label>
            {isEditing ? (
              <Select 
                value={formData.manager_id || 'none'} 
                onValueChange={(v) => {
                  setFormData({ ...formData, manager_id: v === 'none' ? '' : v });
                  setManagerWarning(null);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {groups.map(group => (
                    <SelectGroup key={group.key}>
                      <SelectLabel className="text-xs text-gray-500 px-2 py-1.5">
                        {group.label}
                      </SelectLabel>
                      {validManagers
                        .filter(m => m.group === group.key)
                        .map(m => (
                          <SelectItem 
                            key={m.id} 
                            value={m.id}
                            className={m.isInvalid ? 'text-orange-600' : ''}
                          >
                            <div className="flex items-center gap-2">
                              {m.is_executive && <Crown className="h-3 w-3 text-yellow-500" />}
                              {m.is_department_head && !m.is_executive && <Star className="h-3 w-3 text-blue-500" />}
                              <span>{m.first_name} {m.last_name}</span>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-500 text-xs">{m.job_title}</span>
                              {m.isInvalid && (
                                <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-300">
                                  outside dept
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              manager ? (
                <Link 
                  to={createPageUrl('EmployeeProfile') + `?id=${manager.id}`}
                  className="text-blue-600 hover:text-blue-700 mt-1 block"
                >
                  {manager.first_name} {manager.last_name}
                </Link>
              ) : (
                <p className="text-gray-900 mt-1">—</p>
              )
            )}
          </div>

          {/* Employment Type */}
          <div>
            <Label className="text-xs text-gray-500">Employment Type</Label>
            {isEditing ? (
              <Select 
                value={formData.employment_type} 
                onValueChange={(v) => setFormData({ ...formData, employment_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">{getEmploymentTypeLabel(employee.employment_type)}</p>
            )}
          </div>

          {/* Hours per Week */}
          <div>
            <Label className="text-xs text-gray-500">Hours per Week</Label>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                max="60"
                step="0.5"
                value={formData.hours_per_week}
                onChange={(e) => setFormData({ ...formData, hours_per_week: e.target.value ? parseFloat(e.target.value) : '' })}
                placeholder="e.g. 38"
                className="mt-1"
              />
            ) : (
              <p className="text-gray-900 mt-1">
                {employee.hours_per_week ? `${employee.hours_per_week} hrs/wk` : '—'}
              </p>
            )}
          </div>

          {/* Employment Agreement */}
          <div>
            <Label className="text-xs text-gray-500">Award/Agreement</Label>
            {isEditing ? (
              <Select 
                value={formData.employment_agreement_id || 'none'} 
                onValueChange={handleAgreementChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="None (use defaults)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (use defaults)</SelectItem>
                  {agreements.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">
                {employee.employment_agreement_id ? getAgreementName(employee.employment_agreement_id) : '—'}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-gray-500">Status</Label>
            {isEditing ? (
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="offboarding">Offboarding</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`mt-1 ${getStatusColor(employee.status)}`}>
                {employee.status}
              </Badge>
            )}
          </div>

          {/* Employment Start Date (Service Start) */}
          <div>
            <Label className="text-xs text-gray-500">Employment Start Date</Label>
            {isEditing ? (
              <>
                <Input
                  type="date"
                  value={formData.service_start_date}
                  onChange={(e) => {
                    setFormData({ ...formData, service_start_date: e.target.value });
                    setServiceDateWarning(true);
                  }}
                  className="mt-1"
                />
                {serviceDateWarning && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Changing this affects leave accrual calculations
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-900 mt-1">
                {(employee.service_start_date || employee.start_date) 
                  ? format(new Date(employee.service_start_date || employee.start_date), 'dd MMM yyyy') 
                  : '—'}
              </p>
            )}
          </div>

          {/* Entity Start Date */}
          <div>
            <Label className="text-xs text-gray-500">Entity Start Date</Label>
            {isEditing ? (
              <Input
                type="date"
                value={formData.entity_start_date}
                onChange={(e) => setFormData({ ...formData, entity_start_date: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-gray-900 mt-1">
                {(employee.entity_start_date || employee.start_date) 
                  ? format(new Date(employee.entity_start_date || employee.start_date), 'dd MMM yyyy') 
                  : '—'}
              </p>
            )}
          </div>

          {/* Termination Date */}
          {(employee.termination_date || isEditing) && (
            <div>
              <Label className="text-xs text-gray-500">Termination Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.termination_date}
                  onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="text-gray-900 mt-1">
                  {employee.termination_date ? format(new Date(employee.termination_date), 'dd MMM yyyy') : '—'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Leadership Flags (only in edit mode) */}
        {isEditing && (
          <div className="mt-6 pt-6 border-t">
            <Label className="text-xs text-gray-500 mb-3 block">Leadership & Role Flags</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_manager}
                  onChange={(e) => setFormData({ ...formData, is_manager: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">This employee is a manager</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_department_head}
                  onChange={(e) => setFormData({ ...formData, is_department_head: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Department Head</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_executive}
                  onChange={(e) => setFormData({ ...formData, is_executive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Executive (C-level)</span>
              </label>
            </div>
          </div>
        )}

        {/* Leave Policy Overrides (admin only, edit mode) */}
        {isEditing && leavePolicies.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <Label className="text-xs text-gray-500 mb-3 block">Leave Policy Overrides</Label>
            <p className="text-xs text-gray-400 mb-4">Leave blank to use default policy based on employment type.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Annual Leave Policy</Label>
                <Select 
                  value={formData.annual_leave_policy_id || 'default'} 
                  onValueChange={(v) => setFormData({ ...formData, annual_leave_policy_id: v === 'default' ? '' : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default</SelectItem>
                    {getPoliciesForType('annual').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Personal/Sick Leave Policy</Label>
                <Select 
                  value={formData.personal_leave_policy_id || 'default'} 
                  onValueChange={(v) => setFormData({ ...formData, personal_leave_policy_id: v === 'default' ? '' : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default</SelectItem>
                    {getPoliciesForType('personal').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Long Service Leave Policy</Label>
                <Select 
                  value={formData.long_service_leave_policy_id || 'default'} 
                  onValueChange={(v) => setFormData({ ...formData, long_service_leave_policy_id: v === 'default' ? '' : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default</SelectItem>
                    {getPoliciesForType('long_service').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Recalc prompt when agreement changes */}
        {isEditing && showRecalcPrompt && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Changing the award/agreement may affect leave accrual policies. 
              After saving, consider using "Recalculate Leave" on the Leave tab to update balances.
            </p>
          </div>
        )}

        {/* Show current policy overrides when not editing */}
        {!isEditing && (employee.annual_leave_policy_id || employee.personal_leave_policy_id || employee.long_service_leave_policy_id) && (
          <div className="mt-6 pt-6 border-t">
            <Label className="text-xs text-gray-500 mb-3 block">Leave Policy Overrides</Label>
            <div className="flex gap-4 flex-wrap text-sm">
              {employee.annual_leave_policy_id && (
                <Badge variant="outline">Annual: {getPolicyName(employee.annual_leave_policy_id)}</Badge>
              )}
              {employee.personal_leave_policy_id && (
                <Badge variant="outline">Personal: {getPolicyName(employee.personal_leave_policy_id)}</Badge>
              )}
              {employee.long_service_leave_policy_id && (
                <Badge variant="outline">Long Service: {getPolicyName(employee.long_service_leave_policy_id)}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Direct Reports */}
        {directReports.length > 0 && (
          <>
            <hr className="my-6" />
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Direct Reports ({directReports.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directReports.map(report => (
                <Link
                  key={report.id}
                  to={createPageUrl('EmployeeProfile') + `?id=${report.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                    {report.first_name?.[0]}{report.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {report.first_name} {report.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{report.job_title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}