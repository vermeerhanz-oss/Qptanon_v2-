import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, UserPlus } from 'lucide-react';

const OnboardingInstance = base44.entities.OnboardingInstance;
const OnboardingTemplate = base44.entities.OnboardingTemplate;
const OnboardingTemplateTask = base44.entities.OnboardingTemplateTask;
const OnboardingTask = base44.entities.OnboardingTask;

export function StartOnboardingModal({ employee, onClose, onSuccess }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTemplates();
    // Default start date to employee's start_date if available
    if (employee?.start_date) {
      setStartDate(employee.start_date);
    }
  }, [employee]);

  const loadTemplates = async () => {
    try {
      const allTemplates = await OnboardingTemplate.list();
      const activeTemplates = allTemplates.filter(t => t.active !== false);
      setTemplates(activeTemplates);
      
      const standardTemplate = activeTemplates.find(t => 
        t.name.toLowerCase().includes('standard')
      );
      if (standardTemplate) {
        setSelectedTemplate(standardTemplate.id);
      } else if (activeTemplates.length > 0) {
        setSelectedTemplate(activeTemplates[0].id);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create the onboarding instance
      const newInstance = await OnboardingInstance.create({
        employee_id: employee.id,
        template_id: selectedTemplate,
        status: 'in_progress',
        start_date: startDate || null,
        due_date: dueDate || null,
      });

      // Get template tasks and create onboarding tasks
      const templateTasks = await OnboardingTemplateTask.filter({ 
        template_id: selectedTemplate 
      });

      for (const tt of templateTasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
        // Determine assignee based on role
        let assigneeEmployeeId = null;
        if (tt.assignee_role === 'manager' && employee.manager_id) {
          assigneeEmployeeId = employee.manager_id;
        } else if (tt.assignee_role === 'employee') {
          assigneeEmployeeId = employee.id;
        }
        // For hr and it, leave assignee_employee_id as null

        await OnboardingTask.create({
          instance_id: newInstance.id,
          title: tt.title,
          description: tt.description || '',
          assignee_type: tt.assignee_role,
          assignee_employee_id: assigneeEmployeeId,
          status: 'not_started',
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Error starting onboarding:', err);
      setError(err.message || 'Failed to start onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Start Onboarding</h2>
              <p className="text-sm text-gray-500">
                {employee.first_name} {employee.last_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <Input
                value={`${employee.first_name} ${employee.last_name} (${employee.email})`}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Onboarding Template
              </label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  No templates found. Please create an onboarding template first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date (optional)
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (optional)
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedTemplate || templates.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Start Onboarding
          </Button>
        </div>
      </div>
    </div>
  );
}