import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, CheckCircle2, FileText, User, Users, Briefcase, Monitor, Loader2, Sparkles
} from 'lucide-react';
import { createEmployeeOnboarding } from '@/components/onboarding/onboardingEngine';

const Employee = base44.entities.Employee;
const OnboardingTaskTemplate = base44.entities.OnboardingTaskTemplate;
const Department = base44.entities.Department;

const ROLE_CONFIG = {
  employee: { label: 'Employee Tasks', icon: User, color: 'bg-blue-100 text-blue-700' },
  manager: { label: 'Manager Tasks', icon: Users, color: 'bg-purple-100 text-purple-700' },
  hr: { label: 'HR Tasks', icon: Briefcase, color: 'bg-green-100 text-green-700' },
  it: { label: 'IT Tasks', icon: Monitor, color: 'bg-orange-100 text-orange-700' },
};

export default function TemplateSelection({ 
  userContext, 
  newHireData, 
  templates, 
  onBack, 
  onComplete 
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState({});

  // Score and rank templates
  const rankedTemplates = React.useMemo(() => {
    return templates.map(t => {
      let score = 0;
      let matchReasons = [];

      if (t.entity_id && t.entity_id === newHireData.entity_id) {
        score += 10;
        matchReasons.push('Entity match');
      }
      if (t.department && newHireData.department_id) {
        // We'll check department name match
        const dept = departments[newHireData.department_id];
        if (dept && t.department.toLowerCase() === dept.name?.toLowerCase()) {
          score += 5;
          matchReasons.push('Department match');
        }
      }
      if (t.employment_type && t.employment_type === newHireData.employment_type) {
        score += 3;
        matchReasons.push('Employment type match');
      }
      if (t.is_default) {
        score += 1;
        matchReasons.push('Default template');
      }

      return { ...t, score, matchReasons, isRecommended: score >= 3 };
    }).sort((a, b) => b.score - a.score);
  }, [templates, newHireData, departments]);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTaskTemplates(selectedTemplateId);
    } else {
      setTaskTemplates([]);
    }
  }, [selectedTemplateId]);

  const loadDepartments = async () => {
    const depts = await Department.list();
    const map = {};
    depts.forEach(d => { map[d.id] = d; });
    setDepartments(map);
  };

  const loadTaskTemplates = async (templateId) => {
    setIsLoadingTasks(true);
    try {
      const tasks = await OnboardingTaskTemplate.filter({ template_id: templateId });
      tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setTaskTemplates(tasks);
    } catch (e) {
      console.error('Error loading task templates:', e);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const groupedTasks = React.useMemo(() => {
    const groups = { employee: [], manager: [], hr: [], it: [] };
    taskTemplates.forEach(task => {
      const role = task.assigned_to || 'hr';
      if (groups[role]) {
        groups[role].push(task);
      }
    });
    return groups;
  }, [taskTemplates]);

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      // 1. Create employee record
      const employeeData = {
        first_name: newHireData.first_name,
        last_name: newHireData.last_name,
        preferred_name: newHireData.preferred_name || null,
        email: newHireData.email,
        entity_id: newHireData.entity_id || null,
        department_id: newHireData.department_id || null,
        employment_type: newHireData.employment_type,
        hours_per_week: newHireData.hours_per_week,
        location_id: newHireData.location_id || null,
        manager_id: newHireData.manager_id || null,
        start_date: newHireData.start_date,
        service_start_date: newHireData.start_date,
        entity_start_date: newHireData.start_date,
        status: 'onboarding',
        job_title: 'New Hire', // Placeholder
      };

      const newEmployee = await Employee.create(employeeData);

      // 2. Create onboarding instance (skip if blank)
      if (selectedTemplateId) {
        const dept = departments[newHireData.department_id];
        await createEmployeeOnboarding({
          employeeId: newEmployee.id,
          templateId: selectedTemplateId,
          startDate: newHireData.start_date,
          entityId: newHireData.entity_id,
          department: dept?.name || null,
          managerId: newHireData.manager_id,
        });
      }

      onComplete();
    } catch (err) {
      console.error('Error creating onboarding:', err);
      setError(err.message || 'Failed to create employee and onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Step 2: Select Onboarding Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <RadioGroup value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              {/* Blank option */}
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="" id="blank" />
                <Label htmlFor="blank" className="flex-1 cursor-pointer">
                  <div className="font-medium">Blank Onboarding</div>
                  <p className="text-sm text-gray-500">Create employee without onboarding tasks</p>
                </Label>
              </div>

              {/* Templates */}
              {rankedTemplates.map(template => (
                <div 
                  key={template.id} 
                  className={`flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 ${
                    template.isRecommended ? 'border-indigo-200 bg-indigo-50/50' : ''
                  }`}
                >
                  <RadioGroupItem value={template.id} id={template.id} />
                  <Label htmlFor={template.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {template.isRecommended && (
                        <Badge className="bg-indigo-100 text-indigo-700 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Recommended
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-500">{template.description}</p>
                    )}
                    {template.matchReasons.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {template.matchReasons.map((reason, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Task Preview */}
      {selectedTemplateId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : taskTemplates.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No tasks in this template</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                  const tasks = groupedTasks[role];
                  if (tasks.length === 0) return null;
                  const Icon = config.icon;
                  
                  return (
                    <div key={role} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="secondary">{tasks.length}</Badge>
                      </div>
                      <ul className="space-y-2">
                        {tasks.map(task => (
                          <li key={task.id} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />
                            <span>{task.title}</span>
                            {task.required && (
                              <Badge variant="outline" className="text-xs ml-auto">Required</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>
              <p className="font-medium">{newHireData.first_name} {newHireData.last_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Email:</span>
              <p className="font-medium">{newHireData.email}</p>
            </div>
            <div>
              <span className="text-gray-500">Start Date:</span>
              <p className="font-medium">{newHireData.start_date}</p>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <p className="font-medium capitalize">{newHireData.employment_type.replace('_', ' ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Create Employee + Start Onboarding
            </>
          )}
        </Button>
      </div>
    </div>
  );
}