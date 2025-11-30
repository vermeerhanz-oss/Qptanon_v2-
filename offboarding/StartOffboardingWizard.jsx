import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  UserMinus, ChevronRight, ChevronLeft, Loader2, User, Users, 
  Briefcase, Monitor, DollarSign, CheckCircle2, Star, AlertTriangle
} from 'lucide-react';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import { createOffboardingFromTemplate, findOffboardingTemplate } from './offboardingEngine';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const CompanyEntity = base44.entities.CompanyEntity;
const OffboardingTemplate = base44.entities.OffboardingTemplate;
const OffboardingTaskTemplate = base44.entities.OffboardingTaskTemplate;
const EmployeeOffboarding = base44.entities.EmployeeOffboarding;

const EXIT_TYPES = [
  { value: 'voluntary', label: 'Voluntary (Resignation)' },
  { value: 'involuntary', label: 'Involuntary (Termination)' },
  { value: 'redundancy', label: 'Redundancy' },
  { value: 'other', label: 'Other' },
];

const ROLE_ICONS = {
  employee: User,
  manager: Users,
  hr: Briefcase,
  it: Monitor,
  finance: DollarSign,
};

const ROLE_LABELS = {
  employee: 'Employee',
  manager: 'Manager',
  hr: 'HR',
  it: 'IT',
  finance: 'Finance',
};

export default function StartOffboardingWizard({ 
  open, 
  onOpenChange, 
  preselectedEmployee, 
  employees,
  onSuccess 
}) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data
  const [departments, setDepartments] = useState([]);
  const [entities, setEntities] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [existingOffboardings, setExistingOffboardings] = useState([]);
  
  // Form state - Step 1
  const [selectedEmployee, setSelectedEmployee] = useState(preselectedEmployee || null);
  const [lastDay, setLastDay] = useState('');
  const [exitType, setExitType] = useState('voluntary');
  const [managerId, setManagerId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Form state - Step 2
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recommendedTemplateId, setRecommendedTemplateId] = useState('');

  useEffect(() => {
    if (open) {
      loadData();
      if (preselectedEmployee) {
        prefillFromEmployee(preselectedEmployee);
      }
    }
  }, [open, preselectedEmployee]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [depts, ents, tmpls, taskTmpls, offboardings] = await Promise.all([
        Department.list(),
        CompanyEntity.list(),
        OffboardingTemplate.filter({ active: true }),
        OffboardingTaskTemplate.list(),
        EmployeeOffboarding.list(),
      ]);
      setDepartments(depts);
      setEntities(ents);
      setTemplates(tmpls);
      setTaskTemplates(taskTmpls);
      setExistingOffboardings(offboardings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const prefillFromEmployee = (emp) => {
    setSelectedEmployee(emp);
    setManagerId(emp.manager_id || '');
    setEntityId(emp.entity_id || '');
    setDepartmentId(emp.department_id || '');
  };

  const handleEmployeeSelect = (emp) => {
    prefillFromEmployee(emp);
  };

  // Find recommended template when exit type changes
  useEffect(() => {
    if (selectedEmployee && exitType && templates.length > 0) {
      findRecommendedTemplate();
    }
  }, [selectedEmployee, exitType, templates]);

  const findRecommendedTemplate = async () => {
    if (!selectedEmployee) return;
    const recommended = await findOffboardingTemplate(selectedEmployee, exitType);
    if (recommended) {
      setRecommendedTemplateId(recommended.id);
      if (!selectedTemplateId) {
        setSelectedTemplateId(recommended.id);
      }
    }
  };

  // Filter templates based on criteria
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      // Match by entity if specified
      if (t.entity_id && entityId && t.entity_id !== entityId) return false;
      // Match by exit type if specified
      if (t.exit_type && t.exit_type !== exitType) return false;
      // Match by employment type if specified
      if (t.employment_type && selectedEmployee?.employment_type && 
          t.employment_type !== selectedEmployee.employment_type) return false;
      return true;
    });
  }, [templates, entityId, exitType, selectedEmployee]);

  // Get tasks for selected template
  const selectedTemplateTasks = useMemo(() => {
    if (!selectedTemplateId) return [];
    return taskTemplates.filter(t => t.template_id === selectedTemplateId);
  }, [selectedTemplateId, taskTemplates]);

  // Group tasks by role
  const tasksByRole = useMemo(() => {
    const groups = { employee: [], manager: [], hr: [], it: [], finance: [] };
    selectedTemplateTasks.forEach(task => {
      const role = task.assigned_to || 'hr';
      if (groups[role]) {
        groups[role].push(task);
      }
    });
    // Sort each group by order_index
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    });
    return groups;
  }, [selectedTemplateTasks]);

  const canProceedStep1 = selectedEmployee && lastDay && exitType;
  const canSubmit = canProceedStep1;

  const handleSubmit = async () => {
    if (!selectedEmployee || !lastDay) return;
    
    setIsSubmitting(true);
    try {
      const user = await base44.auth.me();
      
      const offboarding = await createOffboardingFromTemplate({
        employee: selectedEmployee,
        templateId: selectedTemplateId || null,
        lastDay,
        exitType,
        reason: notes || null,
        createdByUserId: user.id,
      });

      // Update manager/entity/department if changed
      if (managerId !== selectedEmployee.manager_id || 
          entityId !== selectedEmployee.entity_id ||
          departmentId !== selectedEmployee.department_id) {
        await Employee.update(selectedEmployee.id, {
          manager_id: managerId || null,
          entity_id: entityId || null,
          department_id: departmentId || null,
        });
      }

      onSuccess(offboarding);
    } catch (error) {
      console.error('Error creating offboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'active' || e.status === 'onboarding');
  }, [employees]);

  const managers = useMemo(() => {
    return employees.filter(e => e.is_manager || e.status === 'active');
  }, [employees]);

  const getDepartmentName = (id) => departments.find(d => d.id === id)?.name || '';
  const getEntityName = (id) => entities.find(e => e.id === id)?.name || '';

  // Check for existing active offboarding
  const activeOffboarding = useMemo(() => {
    if (!selectedEmployee) return null;
    return existingOffboardings.find(o => 
      o.employee_id === selectedEmployee.id && 
      ['draft', 'scheduled', 'in_progress'].includes(o.status)
    );
  }, [selectedEmployee, existingOffboardings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <span>Start Offboarding</span>
              <p className="text-sm font-normal text-gray-500">
                Step {step} of 2: {step === 1 ? 'Employee Details' : 'Template & Preview'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {step === 1 && (
              <div className="space-y-4 py-4">
                {/* Employee Selection */}
                {!preselectedEmployee && (
                  <div>
                    <Label>Employee *</Label>
                    <Select
                      value={selectedEmployee?.id || ''}
                      onValueChange={(id) => handleEmployeeSelect(employees.find(e => e.id === id))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeEmployees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {getDisplayName(emp)} – {emp.job_title || 'No title'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedEmployee && preselectedEmployee && (
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                        {getInitials(selectedEmployee)}
                      </div>
                      <div>
                        <p className="font-medium">{getDisplayName(selectedEmployee)}</p>
                        <p className="text-sm text-gray-500">{selectedEmployee.job_title}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Active offboarding warning */}
                {activeOffboarding && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">
                        This employee already has an active offboarding
                      </p>
                      <p className="text-yellow-700 mt-1">
                        Status: {activeOffboarding.status} · Last day: {activeOffboarding.last_day}
                      </p>
                      <p className="text-yellow-600 mt-1">
                        Proceeding will create a second offboarding record. Consider cancelling the existing one first.
                      </p>
                    </div>
                  </div>
                )}

                {/* Last Day */}
                <div>
                  <Label>Last Working Day *</Label>
                  <Input
                    type="date"
                    value={lastDay}
                    onChange={(e) => setLastDay(e.target.value)}
                  />
                </div>

                {/* Exit Type */}
                <div>
                  <Label>Exit Type *</Label>
                  <Select value={exitType} onValueChange={setExitType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXIT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Manager */}
                <div>
                  <Label>Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {managers.filter(m => m.id !== selectedEmployee?.id).map(m => (
                        <SelectItem key={m.id} value={m.id}>{getDisplayName(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Entity & Department */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Entity</Label>
                    <Select value={entityId} onValueChange={setEntityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None</SelectItem>
                        {entities.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>None</SelectItem>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for departure, handover notes, etc."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-4">
                {/* Template Selection */}
                <div>
                  <Label>Offboarding Template</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>No template (manual tasks only)</SelectItem>
                      {filteredTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            {t.name}
                            {t.id === recommendedTemplateId && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {recommendedTemplateId && selectedTemplateId === recommendedTemplateId && (
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                      <Star className="h-3 w-3" /> Recommended based on employee details
                    </p>
                  )}
                </div>

                {/* Task Preview */}
                {selectedTemplateId && selectedTemplateTasks.length > 0 && (
                  <div className="space-y-3">
                    <Label>Tasks to be created ({selectedTemplateTasks.length})</Label>
                    
                    {Object.entries(tasksByRole).map(([role, tasks]) => {
                      if (tasks.length === 0) return null;
                      const RoleIcon = ROLE_ICONS[role] || User;
                      return (
                        <Card key={role}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <RoleIcon className="h-4 w-4 text-gray-500" />
                              <span className="font-medium text-sm">{ROLE_LABELS[role]} Tasks</span>
                              <Badge variant="secondary" className="ml-auto">{tasks.length}</Badge>
                            </div>
                            <div className="space-y-1">
                              {tasks.map((task, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                  <CheckCircle2 className="h-3 w-3 text-gray-300" />
                                  <span className="truncate">{task.title}</span>
                                  {task.required && (
                                    <span className="text-red-500 text-xs">*</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {selectedTemplateId && selectedTemplateTasks.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No tasks defined for this template
                  </p>
                )}

                {!selectedTemplateId && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No template selected. You can add tasks manually after creation.
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => step === 1 ? onOpenChange(false) : setStep(1)}
              >
                {step === 1 ? 'Cancel' : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </>
                )}
              </Button>

              {step === 1 ? (
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Create Offboarding
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}