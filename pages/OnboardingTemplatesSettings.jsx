import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  GripVertical,
  ChevronRight,
  Loader2,
  ClipboardList
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const OnboardingTemplate = base44.entities.OnboardingTemplate;
const OnboardingTaskTemplate = base44.entities.OnboardingTaskTemplate;

export default function OnboardingTemplatesSettings() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template form
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    department: '',
    default_for_role: '',
    active: true,
  });

  // Task form
  const [taskForm, setTaskForm] = useState({
    task_name: '',
    description: '',
    assigned_to: 'HR',
    due_offset_days: 0,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadTaskTemplates(selectedTemplate.id);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await OnboardingTemplate.list();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaskTemplates = async (templateId) => {
    try {
      const data = await OnboardingTaskTemplate.filter({ template_id: templateId });
      data.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setTaskTemplates(data);
    } catch (error) {
      console.error('Error loading task templates:', error);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', department: '', default_for_role: '', active: true });
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      department: template.department || '',
      default_for_role: template.default_for_role || '',
      active: template.active !== false,
    });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name) return;
    setIsSubmitting(true);
    try {
      if (editingTemplate) {
        await OnboardingTemplate.update(editingTemplate.id, templateForm);
      } else {
        const newTemplate = await OnboardingTemplate.create(templateForm);
        setSelectedTemplate(newTemplate);
      }
      await loadTemplates();
      setShowTemplateModal(false);
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      // Delete all task templates first
      const tasks = await OnboardingTaskTemplate.filter({ template_id: template.id });
      for (const task of tasks) {
        await OnboardingTaskTemplate.delete(task.id);
      }
      await OnboardingTemplate.delete(template.id);
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
        setTaskTemplates([]);
      }
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ task_name: '', description: '', assigned_to: 'HR', due_offset_days: 0 });
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      task_name: task.task_name,
      description: task.description || '',
      assigned_to: task.assigned_to,
      due_offset_days: task.due_offset_days || 0,
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.task_name || !selectedTemplate) return;
    setIsSubmitting(true);
    try {
      if (editingTask) {
        await OnboardingTaskTemplate.update(editingTask.id, taskForm);
      } else {
        await OnboardingTaskTemplate.create({
          ...taskForm,
          template_id: selectedTemplate.id,
          order_index: taskTemplates.length,
        });
      }
      await loadTaskTemplates(selectedTemplate.id);
      setShowTaskModal(false);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!confirm('Delete this task?')) return;
    try {
      await OnboardingTaskTemplate.delete(task.id);
      await loadTaskTemplates(selectedTemplate.id);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(taskTemplates);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTaskTemplates(items);

    // Update order_index for all items
    try {
      await Promise.all(
        items.map((item, index) =>
          OnboardingTaskTemplate.update(item.id, { order_index: index })
        )
      );
    } catch (error) {
      console.error('Error updating order:', error);
      await loadTaskTemplates(selectedTemplate.id);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'HR': return 'bg-purple-100 text-purple-700';
      case 'MANAGER': return 'bg-blue-100 text-blue-700';
      case 'IT': return 'bg-orange-100 text-orange-700';
      case 'EMPLOYEE': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('OnboardingDashboard')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Templates</h1>
          <p className="text-gray-500">Create and manage onboarding task templates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Templates</h2>
                <Button size="sm" onClick={handleCreateTemplate}>
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>

              {templates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No templates yet
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {template.name}
                            </span>
                            {!template.active && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          {template.department && (
                            <p className="text-xs text-gray-500 mt-0.5">{template.department}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Task Templates */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h2>
                    {selectedTemplate.description && (
                      <p className="text-sm text-gray-500 mt-1">{selectedTemplate.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditTemplate(selectedTemplate)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteTemplate(selectedTemplate)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Tasks ({taskTemplates.length})</h3>
                  <Button size="sm" onClick={handleCreateTask}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                  </Button>
                </div>

                {taskTemplates.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                    <ClipboardList className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No tasks yet</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleCreateTask}>
                      Add First Task
                    </Button>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="tasks">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {taskTemplates.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`p-4 rounded-lg border bg-white ${
                                    snapshot.isDragging ? 'shadow-lg border-blue-300' : 'border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="pt-1 cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-gray-900">{task.task_name}</span>
                                        <Badge variant="secondary" className={getRoleBadgeColor(task.assigned_to)}>
                                          {task.assigned_to}
                                        </Badge>
                                      </div>
                                      {task.description && (
                                        <p className="text-sm text-gray-500">{task.description}</p>
                                      )}
                                      <p className="text-xs text-gray-400 mt-1">
                                        Due: {task.due_offset_days === 0 
                                          ? 'On start date' 
                                          : task.due_offset_days > 0 
                                            ? `${task.due_offset_days} days after start`
                                            : `${Math.abs(task.due_offset_days)} days before start`
                                        }
                                      </p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8"
                                        onClick={() => handleEditTask(task)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-red-600"
                                        onClick={() => handleDeleteTask(task)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Select a template to view and edit tasks</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update template details' : 'Create a new onboarding template'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Standard Employee Onboarding"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="Brief description of this template"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={templateForm.department}
                onChange={(e) => setTemplateForm({ ...templateForm, department: e.target.value })}
                placeholder="e.g., Engineering"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Default for Role</Label>
              <Input
                value={templateForm.default_for_role}
                onChange={(e) => setTemplateForm({ ...templateForm, default_for_role: e.target.value })}
                placeholder="e.g., Software Engineer"
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={templateForm.active}
                onCheckedChange={(checked) => setTemplateForm({ ...templateForm, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!templateForm.name || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update task details' : 'Add a new task to this template'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Task Name *</Label>
              <Input
                value={taskForm.task_name}
                onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })}
                placeholder="e.g., Set up email account"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Task details and instructions"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select 
                value={taskForm.assigned_to} 
                onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date Offset (days from start date)</Label>
              <Input
                type="number"
                value={taskForm.due_offset_days}
                onChange={(e) => setTaskForm({ ...taskForm, due_offset_days: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use negative numbers for tasks due before start date (e.g., -3 = 3 days before)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTask} disabled={!taskForm.task_name || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTask ? 'Save Changes' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}