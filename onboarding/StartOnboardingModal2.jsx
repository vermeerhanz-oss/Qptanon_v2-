import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import { startOnboarding } from './onboardingAutomation';

const OnboardingTemplate = base44.entities.OnboardingTemplate;
const Employee = base44.entities.Employee;

export default function StartOnboardingModal2({ open, onClose, onSuccess, preselectedEmployeeId }) {
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(preselectedEmployeeId || '');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (preselectedEmployeeId) {
      setSelectedEmployee(preselectedEmployeeId);
    }
  }, [preselectedEmployeeId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, employeesData, currentUser] = await Promise.all([
        OnboardingTemplate.filter({ active: true }),
        Employee.filter({ status: 'active' }),
        base44.auth.me(),
      ]);
      setTemplates(templatesData);
      setEmployees(employeesData);
      setUser(currentUser);

      // Pre-fill start date with today
      setStartDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !selectedTemplate || !startDate) return;

    setIsSubmitting(true);
    try {
      await startOnboarding(
        selectedEmployee,
        selectedTemplate,
        startDate,
        user?.id
      );
      onSuccess?.();
      onClose();
      // Reset form
      setSelectedEmployee('');
      setSelectedTemplate('');
      setStartDate('');
    } catch (error) {
      console.error('Error starting onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Onboarding</DialogTitle>
          <DialogDescription>
            Select an employee and template to begin the onboarding process.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div>
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Onboarding Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedEmployee || !selectedTemplate || !startDate}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Start Onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}