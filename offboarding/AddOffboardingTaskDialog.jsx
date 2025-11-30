import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getDisplayName } from '@/components/utils/displayName';

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'it', label: 'IT' },
  { value: 'finance', label: 'Finance' },
];

export default function AddOffboardingTaskDialog({ open, onOpenChange, onSubmit, employees }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to_role: 'hr',
    assigned_to_employee_id: '',
    due_date: '',
    required: true,
    link_url: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: formData.title,
        description: formData.description || null,
        assigned_to_role: formData.assigned_to_role,
        assigned_to_employee_id: formData.assigned_to_employee_id || null,
        due_date: formData.due_date || null,
        required: formData.required,
        link_url: formData.link_url || null,
        status: 'not_started',
      });
      // Reset form
      setFormData({
        title: '',
        description: '',
        assigned_to_role: 'hr',
        assigned_to_employee_id: '',
        due_date: '',
        required: true,
        link_url: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Offboarding Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assigned Role</Label>
              <Select
                value={formData.assigned_to_role}
                onValueChange={(v) => setFormData({ ...formData, assigned_to_role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Assign to Employee (optional)</Label>
            <Select
              value={formData.assigned_to_employee_id}
              onValueChange={(v) => setFormData({ ...formData, assigned_to_employee_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {employees.filter(e => e.status === 'active').map(e => (
                  <SelectItem key={e.id} value={e.id}>{getDisplayName(e)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Link URL (optional)</Label>
            <Input
              value={formData.link_url}
              onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={formData.required}
              onCheckedChange={(v) => setFormData({ ...formData, required: v })}
            />
            <Label htmlFor="required" className="cursor-pointer">Required for offboarding completion</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.title.trim() || isSubmitting}>
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}