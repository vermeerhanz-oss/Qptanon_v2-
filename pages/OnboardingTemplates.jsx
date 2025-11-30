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
  Plus, Pencil, Trash2, GripVertical, Copy, Loader2, ClipboardList, ArrowLeft
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';

const OnboardingTemplate = base44.entities.OnboardingTemplate;
const OnboardingTaskTemplate = base44.entities.OnboardingTaskTemplate;

export default function OnboardingTemplates() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    department: '',
    active: true,
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: 'hr',
    due_offset_days: 0,
    required: true,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadTaskTemplates(selectedTemplate.id);
    }
  }, [selectedTemplate]);

  const checkPermissions = async () => {
    const ctx = await getCurrentUserEmployeeContext();
    if (!ctx.permissions?.canManageOnboarding) {
      window.location.href = createPageUrl('Home');
      return;
    }
    loadTemplates();
  };

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

  // Template CRUD
  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', department: '', active: true });
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template, e) => {
    e?.stopPropagation();
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      department: template.department || '',
      active: template.active !== false,
    });
    setShowTemplateModal(true);
  };

  const handleDuplicateTemplate = async (template, e) => {
    e?.stopPropagation();
    try {
      const newTemplate = await OnboardingTemplate.create({
        name: `${template.name} (Copy)`,
        description: template.description,
        department: template.department,
        active: true,
      });

      // Copy tasks
      const tasks = await OnboardingTaskTemplate.filter({ template_id: template.id });
      for (const task of tasks) {
        await OnboardingTaskTemplate.create({
          template_id: newTemplate.id,
          title: task.title,
          description: task.description,
          assigned_to: task.assigned_to,
          due_offset_days: task.due_offset_days,
          required: task.required,
          order_index: task.order_index,
        });
      }

      toast.success('Template duplicated');
      await loadTemplates();
      setSelectedTemplate(newTemplate);
    } catch (error) {
      toast.error('Failed to duplicate template');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name) return;
    setIsSubmitting(true);
    try {
      if (editingTemplate) {
        await OnboardingTemplate.update(editingTemplate.id, templateForm);
        toast.success('Template updated');
      } else {
        const newTemplate = await OnboardingTemplate.create(templateForm);
        setSelectedTemplate(newTemplate);
        toast.success('Template created');
      }
      await loadTemplates();
      setShowTemplateModal(false);
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (template, e) => {
    e?.stopPropagation();
    if (!confirm('Delete this template and all its tasks? This cannot be undone.')) return;
    try {
      const tasks = await OnboardingTaskTemplate.filter({ template_id: template.id });
      for (const task of tasks) {
        await OnboardingTaskTemplate.delete(task.id);
      }
      await OnboardingTemplate.delete(template.id);
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
        setTaskTemplates([]);
      }
      toast.success('Template deleted');
      await loadTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  // Task CRUD
  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ title: '', description: '', assigned_to: 'hr', due_offset_days: 0, required: true });
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to || 'hr',
      due_offset_days: task.due_offset_days || 0,
      required: task.required !== false,
    });
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !selectedTemplate) return;
    setIsSubmitting(true);
    try {
      if (editingTask) {
        await OnboardingTaskTemplate.update(editingTask.id, taskForm);
        toast.success('Task updated');
      } else {
        await OnboardingTaskTemplate.create({
          ...taskForm,
          template_id: selectedTemplate.id,
          order_index: taskTemplates.length,
        });
        toast.success('Task added');
      }
      await loadTaskTemplates(selectedTemplate.id);
      setShowTaskModal(false);
    } catch (error) {
      toast.error('Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!confirm('Delete this task?')) return;
    try {
      await OnboardingTaskTemplate.delete(task.id);
      toast.success('Task deleted');
      await loadTaskTemplates(selectedTemplate.id);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(taskTemplates);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTaskTemplates(items);

    try {
      await Promise.all(
        items.map((item, index) =>
          OnboardingTaskTemplate.update(item.id, { order_index: index })
        )
      );
    } catch (error) {
      await loadTaskTemplates(selectedTemplate.id);
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      hr: 'bg-purple-100 text-purple-700',
      manager: 'bg-blue-100 text-blue-700',
      it: 'bg-orange-100 text-orange-700',
      employee: 'bg-green-100 text-green-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const formatDueOffset = (days) => {
    if (days === 0) return 'On start date';
    if (days > 0) return `Day ${days}`;
    return `${Math.abs(days)} days before`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('OnboardingManage')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Templates</h1>
          <p className="text-gray-500">Create reusable onboarding checklists</p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="lg:col-span-1 space-y-3">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No templates yet</p>
                <Button onClick={handleCreateTemplate} className="mt-4">
                  Create First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map(template => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'ring-2 ring-indigo-500 border-indigo-500'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
                        {!template.active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                      )}
                      {template.department && (
                        <Badge variant="outline" className="mt-2 text-xs">{template.department}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDuplicateTemplate(template, e)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleEditTemplate(template, e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={(e) => handleDeleteTemplate(template, e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Tasks Panel */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h2>
                    <p className="text-sm text-gray-500">{taskTemplates.length} tasks</p>
                  </div>
                  <Button onClick={handleCreateTask}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>

                {taskTemplates.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                    <ClipboardList className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No tasks yet</p>
                    <Button variant="outline" className="mt-3" onClick={handleCreateTask}>
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
                                    snapshot.isDragging ? 'shadow-lg border-indigo-300' : 'border-gray-200'
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
                                        <span className="font-medium text-gray-900">{task.title}</span>
                                        <Badge className={getRoleBadge(task.assigned_to)}>
                                          {task.assigned_to}
                                        </Badge>
                                        {task.required && (
                                          <Badge variant="outline" className="text-xs">Required</Badge>
                                        )}
                                      </div>
                                      {task.description && (
                                        <p className="text-sm text-gray-500">{task.description}</p>
                                      )}
                                      <p className="text-xs text-gray-400 mt-1">
                                        Due: {formatDueOffset(task.due_offset_days)}
                                      </p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTask(task)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteTask(task)}>
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
              <CardContent className="py-16 text-center">
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
              {editingTemplate ? 'Update template details' : 'Create a reusable onboarding template'}
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
              <Label>Department (optional)</Label>
              <Input
                value={templateForm.department}
                onChange={(e) => setTemplateForm({ ...templateForm, department: e.target.value })}
                placeholder="e.g., Engineering, Sales"
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
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
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
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date (days from start)</Label>
              <Input
                type="number"
                value={taskForm.due_offset_days}
                onChange={(e) => setTaskForm({ ...taskForm, due_offset_days: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                0 = on start date, 7 = Day 7, -3 = 3 days before start
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Required to complete onboarding</Label>
              <Switch
                checked={taskForm.required}
                onCheckedChange={(checked) => setTaskForm({ ...taskForm, required: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTask} disabled={!taskForm.title || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTask ? 'Save Changes' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}