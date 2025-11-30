import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, UserMinus } from 'lucide-react';

const OffboardingInstance = base44.entities.OffboardingInstance;
const OffboardingTemplate = base44.entities.OffboardingTemplate;
const OffboardingTemplateTask = base44.entities.OffboardingTemplateTask;
const OffboardingTask = base44.entities.OffboardingTask;
const Employee = base44.entities.Employee;

export function StartOffboardingModal({ employee, onClose, onSuccess }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [finalDay, setFinalDay] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const allTemplates = await OffboardingTemplate.list();
      setTemplates(allTemplates);
      
      // Default to "Standard Offboarding" if it exists
      const standardTemplate = allTemplates.find(t => 
        t.name.toLowerCase().includes('standard')
      );
      if (standardTemplate) {
        setSelectedTemplate(standardTemplate.id);
      } else if (allTemplates.length > 0) {
        setSelectedTemplate(allTemplates[0].id);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || !finalDay) {
      setError('Please select a template and final working day');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create the offboarding instance
      const newInstance = await OffboardingInstance.create({
        employee_id: employee.id,
        template_id: selectedTemplate,
        status: 'in_progress',
        final_day: finalDay,
      });

      // Get template tasks and create offboarding tasks
      const templateTasks = await OffboardingTemplateTask.filter({ 
        template_id: selectedTemplate 
      });

      for (const tt of templateTasks) {
        await OffboardingTask.create({
          instance_id: newInstance.id,
          title: tt.title,
          description: tt.description || '',
          assignee_type: tt.assignee_role,
          status: 'not_started',
        });
      }

      // Update employee end date
      await Employee.update(employee.id, { end_date: finalDay });

      onSuccess();
    } catch (err) {
      console.error('Error starting offboarding:', err);
      setError(err.message || 'Failed to start offboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Start Offboarding</h2>
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
                Offboarding Template
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
                  No templates found. Please create an offboarding template first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Final Working Day
              </label>
              <Input
                type="date"
                value={finalDay}
                onChange={(e) => setFinalDay(e.target.value)}
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
            disabled={isSubmitting || !selectedTemplate || !finalDay || templates.length === 0}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Start Offboarding
          </Button>
        </div>
      </div>
    </div>
  );
}