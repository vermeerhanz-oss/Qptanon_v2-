import { base44 } from '@/api/base44Client';
import { initializeLeaveBalances } from '@/components/utils/leaveBalanceInit';

const OnboardingInstance = base44.entities.OnboardingInstance;
const OnboardingTask = base44.entities.OnboardingTask;
const OnboardingTaskTemplate = base44.entities.OnboardingTaskTemplate;
const Employee = base44.entities.Employee;
const CompanyEntity = base44.entities.CompanyEntity;

/**
 * Resolve assigned user based on role using org chart / employee profile
 */
async function resolveAssignedUser(role, employee, entity) {
  switch (role) {
    case 'MANAGER':
      return employee.manager_id || null;
    case 'HR':
      return entity?.hr_contact_id || null;
    case 'IT':
      return entity?.it_contact_id || null;
    case 'EMPLOYEE':
      return employee.user_id || employee.id || null;
    default:
      return null;
  }
}

/**
 * Triggered when a new OnboardingInstance is created.
 * Generates all OnboardingTask records from the template.
 * Uses org chart and employee profile as source of truth.
 */
export async function onOnboardingStart(instanceId) {
  // Get the instance
  const instances = await OnboardingInstance.filter({ id: instanceId });
  if (instances.length === 0) return;
  const instance = instances[0];

  // Get the employee
  const employees = await Employee.filter({ id: instance.employee_id });
  if (employees.length === 0) return;
  const employee = employees[0];

  // Get entity for HR/IT contacts (from employee's entity_id)
  let entity = null;
  if (employee.entity_id) {
    const entities = await CompanyEntity.filter({ id: employee.entity_id });
    entity = entities[0] || null;
  }

  // Get all task templates for this template
  const taskTemplates = await OnboardingTaskTemplate.filter({ template_id: instance.template_id });
  
  // Sort by order_index
  taskTemplates.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  // Generate tasks
  const startDate = new Date(instance.start_date);
  
  for (const template of taskTemplates) {
    // Calculate due date
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (template.due_offset_days || 0));

    // Resolve assigned_to_user_id based on role and org chart
    const assignedToUserId = await resolveAssignedUser(template.assigned_to, employee, entity);

    await OnboardingTask.create({
      instance_id: instanceId,
      task_template_id: template.id,
      task_name: template.task_name,
      description: template.description || '',
      assigned_to_user_id: assignedToUserId,
      assigned_to_role: template.assigned_to,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'not_started',
    });
  }

  // Set instance to active and update employee status
  await OnboardingInstance.update(instanceId, { status: 'active' });
  
  // Update employee status to onboarding if they're not yet active
  if (employee.status !== 'active') {
    await Employee.update(employee.id, { status: 'onboarding' });
  }
  
  // Initialize leave balances for the employee
  await initializeLeaveBalances(employee.id, instance.start_date);
}

/**
 * Triggered when OnboardingTask.status transitions to "completed".
 * Updates completed_at and checks if all tasks are done.
 */
export async function onTaskCompleted(taskId) {
  // Get the task
  const tasks = await OnboardingTask.filter({ id: taskId });
  if (tasks.length === 0) return;
  const task = tasks[0];

  // Update completed_at
  await OnboardingTask.update(taskId, {
    completed_at: new Date().toISOString(),
  });

  // Check if all tasks for this instance are completed
  const allTasks = await OnboardingTask.filter({ instance_id: task.instance_id });
  const allCompleted = allTasks.every(t => 
    t.id === taskId ? true : t.status === 'completed'
  );

  if (allCompleted) {
    await OnboardingInstance.update(task.instance_id, { status: 'completed' });
  }
}

/**
 * Calculate onboarding progress for an instance
 */
export async function getOnboardingProgress(instanceId) {
  const tasks = await OnboardingTask.filter({ instance_id: instanceId });
  if (tasks.length === 0) return { total: 0, completed: 0, percentage: 0 };

  const completed = tasks.filter(t => t.status === 'completed').length;
  return {
    total: tasks.length,
    completed,
    percentage: Math.round((completed / tasks.length) * 100),
  };
}

/**
 * Start onboarding for an employee
 */
export async function startOnboarding(employeeId, templateId, startDate, launchedByUserId) {
  // Create the instance
  const instance = await OnboardingInstance.create({
    employee_id: employeeId,
    template_id: templateId,
    start_date: startDate,
    launched_by_user_id: launchedByUserId,
    status: 'pending',
  });

  // Generate tasks
  await onOnboardingStart(instance.id);

  return instance;
}

/**
 * Complete a task and trigger automation
 */
export async function completeTask(taskId) {
  await OnboardingTask.update(taskId, { status: 'completed' });
  await onTaskCompleted(taskId);
}

/**
 * Get tasks grouped by role for an instance
 */
export async function getTasksByRole(instanceId) {
  const tasks = await OnboardingTask.filter({ instance_id: instanceId });
  
  const grouped = {
    HR: [],
    MANAGER: [],
    IT: [],
    EMPLOYEE: [],
  };

  tasks.forEach(task => {
    if (grouped[task.assigned_to_role]) {
      grouped[task.assigned_to_role].push(task);
    }
  });

  // Sort each group by due_date
  Object.keys(grouped).forEach(role => {
    grouped[role].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  });

  return grouped;
}