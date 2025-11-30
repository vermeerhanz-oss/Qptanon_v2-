import { base44 } from '@/api/base44Client';
import { initializeLeaveBalances } from '@/components/utils/leaveBalanceInit';
// import { ensureLeaveBalances } from '@/components/utils/LeaveEngine';
import { sendNotification } from '@/components/utils/notifications';
import { logForCurrentUser } from '@/components/utils/audit';
import { provisionUserForEmployee } from '@/components/utils/googleWorkspace';

const OnboardingTemplate = base44.entities.OnboardingTemplate;
const OnboardingTaskTemplate = base44.entities.OnboardingTaskTemplate;
const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const EmployeeOnboardingTask = base44.entities.EmployeeOnboardingTask;
const Employee = base44.entities.Employee;

/**
 * Create an EmployeeOnboarding run from a template
 * Automatically creates all EmployeeOnboardingTask records
 * 
 * @param {Object} params
 * @param {string} params.employeeId - Employee ID
 * @param {string} params.templateId - OnboardingTemplate ID
 * @param {string} params.startDate - Employment start date (YYYY-MM-DD)
 * @param {string} [params.entityId] - Entity ID
 * @param {string} [params.department] - Department
 * @param {string} [params.managerId] - Manager ID
 * @param {string} [params.notes] - Additional notes
 * @returns {Promise<Object>} Created EmployeeOnboarding record
 */
export async function createEmployeeOnboarding(params) {
  const { employeeId, templateId, startDate, entityId, department, managerId, notes } = params;

  // Create the onboarding record
  const onboarding = await EmployeeOnboarding.create({
    employee_id: employeeId,
    template_id: templateId,
    entity_id: entityId || null,
    department: department || null,
    manager_id: managerId || null,
    start_date: startDate,
    status: 'in_progress',
    notes: notes || null,
  });

  // Get all task templates for this template
  const taskTemplates = await OnboardingTaskTemplate.filter({ template_id: templateId });
  
  // Sort by order_index
  taskTemplates.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  // Create tasks from templates
  const startDateObj = new Date(startDate);
  const tasks = [];

  for (const template of taskTemplates) {
    // Calculate due date from offset
    let dueDate = null;
    if (template.due_offset_days !== undefined && template.due_offset_days !== null) {
      const dueDateObj = new Date(startDateObj);
      dueDateObj.setDate(dueDateObj.getDate() + template.due_offset_days);
      dueDate = dueDateObj.toISOString().split('T')[0];
    }

    tasks.push({
      onboarding_id: onboarding.id,
      task_template_id: template.id,
      title: template.title,
      description: template.description || null,
      category: template.category || null,
      assigned_to_role: template.assigned_to,
      due_date: dueDate,
      status: 'not_started',
      link_url: template.link_url || null,
      policy_id: template.policy_id || null,
      system_code: template.system_code || null,
      required: template.required !== false,
      order_index: template.order_index || 0,
    });
  }

  // Bulk create tasks
  if (tasks.length > 0) {
    await EmployeeOnboardingTask.bulkCreate(tasks);
  }

  // Send notifications to employee for their assigned tasks
  const employees = await Employee.filter({ id: employeeId });
  const employee = employees[0];
  if (employee?.user_id) {
    const employeeTasks = taskTemplates.filter(t => t.assigned_to === 'employee');
    for (const taskTemplate of employeeTasks) {
      try {
        await sendNotification({
          userId: employee.user_id,
          type: 'onboarding_task_assigned',
          title: 'New onboarding task',
          message: taskTemplate.title,
          link: `/onboarding/my`,
          relatedEmployeeId: employee.id,
        });
      } catch (error) {
        console.error('Error sending onboarding task notification:', error);
      }
    }
  }

  // Update employee status to onboarding
  if (employee && employee.status !== 'active') {
    await Employee.update(employeeId, { status: 'onboarding' });
  }

  // Initialize leave balances
  await initializeLeaveBalances(employeeId, startDate);
  
  // Audit log
  const templates = await OnboardingTemplate.filter({ id: templateId });
  const templateName = templates[0]?.name || 'Unknown template';
  await logForCurrentUser({
    eventType: 'onboarding_started',
    entityType: 'EmployeeOnboarding',
    entityId: onboarding.id,
    relatedEmployeeId: employeeId,
    description: `Started onboarding for ${employee?.first_name} ${employee?.last_name} using template ${templateName}`,
  });

  return onboarding;
}

/**
 * Complete a task and check if onboarding is finished
 * Also handles system tasks like Google account provisioning
 * 
 * @param {string} taskId - EmployeeOnboardingTask ID
 * @returns {Promise<{task: Object, onboardingCompleted: boolean, systemResult?: Object}>}
 */
export async function completeTask(taskId) {
  const tasks = await EmployeeOnboardingTask.filter({ id: taskId });
  if (tasks.length === 0) {
    throw new Error('Task not found');
  }
  const task = tasks[0];

  // Get related employee first (needed for system tasks)
  const onboardings = await EmployeeOnboarding.filter({ id: task.onboarding_id });
  const onboarding = onboardings[0];
  const employees = onboarding ? await Employee.filter({ id: onboarding.employee_id }) : [];
  const employee = employees[0];

  let systemResult = null;

  // Handle system tasks before marking complete
  if (task.system_code === 'GOOGLE_ACCOUNT_CREATE' && employee) {
    systemResult = await handleGoogleAccountProvisioning(employee, onboarding);
  }

  // Update task
  await EmployeeOnboardingTask.update(taskId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // Check if all required tasks are complete
  const allTasks = await EmployeeOnboardingTask.filter({ onboarding_id: task.onboarding_id });
  const requiredTasks = allTasks.filter(t => t.required);
  const allRequiredComplete = requiredTasks.every(t => 
    t.id === taskId ? true : t.status === 'completed'
  );

  let onboardingCompleted = false;

  // Audit log for task completion
  await logForCurrentUser({
    eventType: 'onboarding_task_completed',
    entityType: 'EmployeeOnboardingTask',
    entityId: taskId,
    relatedEmployeeId: onboarding?.employee_id,
    description: `Completed onboarding task "${task.title}" for ${employee?.first_name || ''} ${employee?.last_name || ''}`,
  });

  if (allRequiredComplete) {
    await EmployeeOnboarding.update(task.onboarding_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Update employee status to active
    if (onboarding) {
      await Employee.update(onboarding.employee_id, { status: 'active' });
    }
    onboardingCompleted = true;

    // Audit log for onboarding completion
    await logForCurrentUser({
      eventType: 'onboarding_completed',
      entityType: 'EmployeeOnboarding',
      entityId: task.onboarding_id,
      relatedEmployeeId: onboarding?.employee_id,
      description: `Onboarding completed for ${employee?.first_name || ''} ${employee?.last_name || ''}`,
    });
  }

  return { task, onboardingCompleted, systemResult };
}

/**
 * Handle Google account provisioning when the system task is completed
 */
async function handleGoogleAccountProvisioning(employee, onboarding) {
  try {
    const result = await provisionUserForEmployee(employee);
    
    if (result.ok) {
      // Audit log for Google account provisioning
      await logForCurrentUser({
        eventType: 'google_account_provisioned',
        entityType: 'Employee',
        entityId: employee.id,
        relatedEmployeeId: employee.id,
        description: `Google Workspace account provisioned for ${employee.first_name} ${employee.last_name} (${result.google_primary_email})`,
        metadata: {
          google_primary_email: result.google_primary_email,
          google_user_id: result.google_user_id,
        },
      });

      // Send notification to manager
      if (onboarding?.manager_id) {
        const managers = await Employee.filter({ id: onboarding.manager_id });
        const manager = managers[0];
        if (manager?.user_id) {
          await sendNotification({
            userId: manager.user_id,
            type: 'google_account_provisioned',
            title: 'Google account created',
            message: `${employee.first_name} ${employee.last_name}'s Google account has been provisioned.`,
            link: `/employee/${employee.id}`,
            relatedEmployeeId: employee.id,
          });
        }
      }

      return { ok: true, google_primary_email: result.google_primary_email };
    } else {
      // Log error
      await logForCurrentUser({
        eventType: 'google_account_error',
        entityType: 'Employee',
        entityId: employee.id,
        relatedEmployeeId: employee.id,
        description: `Failed to provision Google account for ${employee.first_name} ${employee.last_name}: ${result.error}`,
      });
      return { ok: false, error: result.error };
    }
  } catch (error) {
    console.error('Error provisioning Google account:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get onboarding progress
 * 
 * @param {string} onboardingId - EmployeeOnboarding ID
 * @returns {Promise<Object>} Progress stats
 */
export async function getOnboardingProgress(onboardingId) {
  const tasks = await EmployeeOnboardingTask.filter({ onboarding_id: onboardingId });
  
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const requiredTotal = tasks.filter(t => t.required).length;
  const requiredCompleted = tasks.filter(t => t.required && t.status === 'completed').length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    requiredTotal,
    requiredCompleted,
    requiredPercentage: requiredTotal > 0 ? Math.round((requiredCompleted / requiredTotal) * 100) : 0,
  };
}

/**
 * Get tasks grouped by role
 * 
 * @param {string} onboardingId - EmployeeOnboarding ID
 * @returns {Promise<Object>} Tasks grouped by role
 */
export async function getTasksByRole(onboardingId) {
  const tasks = await EmployeeOnboardingTask.filter({ onboarding_id: onboardingId });
  
  const grouped = {
    employee: [],
    manager: [],
    hr: [],
    it: [],
  };

  tasks.forEach(task => {
    const role = task.assigned_to_role || 'hr';
    if (grouped[role]) {
      grouped[role].push(task);
    }
  });

  // Sort each group by order_index then due_date
  Object.keys(grouped).forEach(role => {
    grouped[role].sort((a, b) => {
      if ((a.order_index || 0) !== (b.order_index || 0)) {
        return (a.order_index || 0) - (b.order_index || 0);
      }
      if (a.due_date && b.due_date) {
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return 0;
    });
  });

  return grouped;
}

/**
 * Get tasks grouped by category
 * 
 * @param {string} onboardingId - EmployeeOnboarding ID
 * @returns {Promise<Object>} Tasks grouped by category
 */
export async function getTasksByCategory(onboardingId) {
  const tasks = await EmployeeOnboardingTask.filter({ onboarding_id: onboardingId });
  
  const grouped = {};
  tasks.forEach(task => {
    const category = task.category || 'General';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(task);
  });

  // Sort each group
  Object.keys(grouped).forEach(category => {
    grouped[category].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  });

  return grouped;
}

/**
 * Find the best matching template for an employee
 * 
 * @param {Object} employee - Employee record
 * @returns {Promise<Object|null>} Best matching template
 */
export async function findBestTemplate(employee) {
  const templates = await OnboardingTemplate.filter({ active: true });
  
  if (templates.length === 0) return null;

  // Score templates by match quality
  const scored = templates.map(t => {
    let score = 0;
    
    // Entity match
    if (t.entity_id && t.entity_id === employee.entity_id) score += 10;
    
    // Department match
    if (t.department && t.department === employee.department) score += 5;
    
    // Employment type match
    if (t.employment_type && t.employment_type === employee.employment_type) score += 3;
    
    // Default bonus
    if (t.is_default) score += 1;
    
    return { template: t, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.template || null;
}

/**
 * Pause an onboarding
 * 
 * @param {string} onboardingId - EmployeeOnboarding ID
 * @param {string} [reason] - Reason for pausing
 */
export async function pauseOnboarding(onboardingId, reason) {
  await EmployeeOnboarding.update(onboardingId, {
    status: 'paused',
    notes: reason || null,
  });
}

/**
 * Resume a paused onboarding
 * 
 * @param {string} onboardingId - EmployeeOnboarding ID
 */
export async function resumeOnboarding(onboardingId) {
  await EmployeeOnboarding.update(onboardingId, {
    status: 'in_progress',
  });
}