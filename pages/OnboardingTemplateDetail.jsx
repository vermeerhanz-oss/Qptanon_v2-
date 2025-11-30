import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

const OnboardingTemplate = base44.entities.OnboardingTemplate;
const OnboardingTemplateTask = base44.entities.OnboardingTemplateTask;

export default function OnboardingTemplateDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('id');

  const [template, setTemplate] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', assignee_role: 'employee', due_day_offset: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      const templates = await OnboardingTemplate.filter({ id: templateId });
      if (templates.length === 0) {
        setIsLoading(false);
        return;
      }
      setTemplate(templates[0]);

      const taskList = await OnboardingTemplateTask.filter({ template_id: templateId });
      setTasks(taskList.sort((a, b) => a.sort_order - b.sort_order));
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [templateId]);

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return;
    setIsSaving(true);
    try {
      await OnboardingTemplateTask.create({
        template_id: templateId,
        title: taskForm.title.trim(),
        assignee_role: taskForm.assignee_role,
        due_day_offset: parseInt(taskForm.due_day_offset) || 0,
        sort_order: tasks.length,
      });
      setTaskForm({ title: '', assignee_role: 'employee', due_day_offset: 0 });
      setShowTaskForm(false);
      await loadData();
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await OnboardingTemplateTask.delete(taskId);
      await loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const roleColors = { hr: 'danger', manager: 'warning', it: 'success', employee: 'default' };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">Template not found</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link to={createPageUrl('OnboardingTemplates')} className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Templates
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
        {template.description && <p className="text-gray-500 mt-1">{template.description}</p>}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Tasks ({tasks.length})</h2>
        <Button onClick={() => setShowTaskForm(!showTaskForm)}>
          {showTaskForm ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Add Task</>}
        </Button>
      </div>

      {showTaskForm && (
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Task title"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                <Select value={taskForm.assignee_role} onValueChange={(v) => setTaskForm({ ...taskForm, assignee_role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due day offset</label>
                <Input
                  type="number"
                  value={taskForm.due_day_offset}
                  onChange={(e) => setTaskForm({ ...taskForm, due_day_offset: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleAddTask} disabled={isSaving}>
              {isSaving ? 'Adding...' : 'Add Task'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 divide-y divide-gray-200">
          {tasks.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No tasks yet</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="p-4 flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-900">{task.title}</span>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={roleColors[task.assignee_role]}>{task.assignee_role.toUpperCase()}</Badge>
                    <span className="text-xs text-gray-500">Day {task.due_day_offset >= 0 ? '+' : ''}{task.due_day_offset}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}