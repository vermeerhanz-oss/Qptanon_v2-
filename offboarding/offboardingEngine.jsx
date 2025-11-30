import { base44 } from '@/api/base44Client';
import { addDays, format } from 'date-fns';
import { sendNotification } from '@/components/utils/notifications';
import { logForCurrentUser } from '@/components/utils/audit';
import { suspendUserForEmployee } from '@/components/utils/googleWorkspace';

const OffboardingTemplate = base44.entities.OffboardingTemplate;
const OffboardingTaskTemplate = base44.entities.OffboardingTaskTemplate;
const EmployeeOffboarding = base44.entities.EmployeeOffboarding;
const EmployeeOffboardingTask = base44.entities.EmployeeOffboardingTask;
const Employee = base44.entities.Employee;

/**
 * Create an offboarding run from a template
 */
export async function createOffboardingFromTemplate({
  employee,
  templateId,
  lastDay,
  exitType,
  reason,
  createdByUserId,
}) {
  // Create the offboarding record
  const offboarding = await EmployeeOffboarding.create({
    employee_id: employee.id,
    template_id: templateId,
    entity_id: employee.entity_id,
    department: employee.department_id,
    manager_id: employee.manager_id,
    last_day: lastDay,
    exit_type: exitType,
    reason: reason || null,
    status: 'scheduled',
    created_by_user_id: createdByUserId,
  });

  // Load task templates
  if (templateId) {
    const taskTemplates = await OffboardingTaskTemplate.filter({ template_id: templateId });
    taskTemplates.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    // Create tasks from templates
    const taskData = taskTemplates.map(tt => {
      let dueDate = null;
      if (tt.due_offset_days !== undefined && tt.due_offset_days !== null) {
        dueDate = format(addDays(new Date(lastDay), tt.due_offset_days), 'yyyy-MM-dd');
      }

      return {
        offboarding_id: offboarding.id,
        task_template_id: tt.id,
        title: tt.title,
        description: tt.description || null,
        category: tt.category || null,
        assigned_to_role: tt.assigned_to,
        due_date: dueDate,
        required: tt.required !== false,
        link_url: tt.link_url || null,
        system_code: tt.system_code || null,
        order_index: tt.order_index || 0,
        status: 'not_started',
      };
    });

    if (taskData.length > 0) {
      await EmployeeOffboardingTask.bulkCreate(taskData);
    }

    // Notify task owners about their assigned tasks
    const employeeFullName = `${employee.first_name} ${employee.last_name}`;
    const employees = await Employee.list();
    
    for (const tt of taskTemplates) {
      let taskOwner = null;
      
      if (tt.assigned_to === 'employee') {
        taskOwner = employee;
      } else if (tt.assigned_to === 'manager' && employee.manager_id) {
        taskOwner = employees.find(e => e.id === employee.manager_id);
      }
      // For hr, it, finance roles - tasks are visible in their dashboards
      
      if (taskOwner?.user_id) {
        try {
          await sendNotification({
            userId: taskOwner.user_id,
            type: 'offboarding_task_assigned',
            title: 'New offboarding task',
            message: `${employeeFullName}: ${tt.title}`,
            link: `/offboarding/manage/${offboarding.id}`,
            relatedEmployeeId: employee.id,
            relatedRequestId: offboarding.id,
          });
        } catch (error) {
          console.error('Error sending offboarding task notification:', error);
        }
      }
    }
  }

  // Update employee status
  await Employee.update(employee.id, { 
    status: 'offboarding',
    termination_date: lastDay,
  });

  // Audit log
  await logForCurrentUser({
    eventType: 'offboarding_started',
    entityType: 'EmployeeOffboarding',
    entityId: offboarding.id,
    relatedEmployeeId: employee.id,
    description: `Started offboarding for ${employee.first_name} ${employee.last_name} (${exitType})`,
  });

  // Notify manager that offboarding has started
  if (employee.manager_id) {
    const employees = await Employee.list();
    const manager = employees.find(e => e.id === employee.manager_id);
    if (manager?.user_id) {
      try {
        const employeeFullName = `${employee.first_name} ${employee.last_name}`;
        await sendNotification({
          userId: manager.user_id,
          type: 'offboarding_started',
          title: 'Offboarding started',
          message: `${employeeFullName} has begun the offboarding process.`,
          link: `/offboarding/manage/${offboarding.id}`,
          relatedEmployeeId: employee.id,
          relatedRequestId: offboarding.id,
        });
      } catch (error) {
        console.error('Error sending offboarding started notification:', error);
      }
    }
  }

  return offboarding;
}

/**
 * Complete an offboarding task
 * Handles system tasks like Google account suspension
 */
export async function completeOffboardingTask(taskId) {
  // Get task first to check system_code
  const tasks = await EmployeeOffboardingTask.filter({ id: taskId });
  if (tasks.length === 0) {
    throw new Error('Task not found');
  }
  const taskData = tasks[0];

  // Get offboarding and employee
  const offboardings = await EmployeeOffboarding.filter({ id: taskData.offboarding_id });
  const offboarding = offboardings[0];
  const employees = offboarding ? await Employee.filter({ id: offboarding.employee_id }) : [];
  const employee = employees[0];

  let systemResult = null;

  // Handle system tasks before marking complete
  if (taskData.system_code === 'GOOGLE_ACCOUNT_SUSPEND' && employee) {
    systemResult = await handleGoogleAccountSuspension(employee, offboarding);
  }

  // Update task to completed
  const task = await EmployeeOffboardingTask.update(taskId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // Audit log for task completion
  await logForCurrentUser({
    eventType: 'offboarding_task_completed',
    entityType: 'EmployeeOffboardingTask',
    entityId: taskId,
    relatedEmployeeId: offboarding?.employee_id,
    description: `Completed offboarding task "${task.title}" for ${employee?.first_name || ''} ${employee?.last_name || ''}`,
  });

  // Check if all required tasks are complete
  const allTasks = await EmployeeOffboardingTask.filter({ offboarding_id: task.offboarding_id });
  const requiredTasks = allTasks.filter(t => t.required);
  const allComplete = requiredTasks.every(t => t.status === 'completed');

  if (allComplete) {
    await EmployeeOffboarding.update(task.offboarding_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Update employee status
    if (offboarding) {
      await Employee.update(offboarding.employee_id, { status: 'terminated' });
    }

    // Audit log for offboarding completion
    await logForCurrentUser({
      eventType: 'offboarding_completed',
      entityType: 'EmployeeOffboarding',
      entityId: task.offboarding_id,
      relatedEmployeeId: offboarding?.employee_id,
      description: `Offboarding completed for ${employee?.first_name || ''} ${employee?.last_name || ''}`,
    });

    return { taskCompleted: true, offboardingCompleted: true };
  }

  return { taskCompleted: true, offboardingCompleted: false, systemResult };
}

/**
 * Handle Google account suspension when the system task is completed
 */
async function handleGoogleAccountSuspension(employee, offboarding) {
  try {
    const result = await suspendUserForEmployee(employee);
    
    if (result.ok) {
      // Audit log for Google account suspension
      await logForCurrentUser({
        eventType: 'google_account_suspended',
        entityType: 'Employee',
        entityId: employee.id,
        relatedEmployeeId: employee.id,
        description: `Google Workspace account suspended for ${employee.first_name} ${employee.last_name}`,
        metadata: {
          google_primary_email: employee.google_primary_email,
        },
      });

      // Send notification to manager
      if (offboarding?.manager_id) {
        const managers = await Employee.filter({ id: offboarding.manager_id });
        const manager = managers[0];
        if (manager?.user_id) {
          await sendNotification({
            userId: manager.user_id,
            type: 'google_account_suspended',
            title: 'Google account suspended',
            message: `Google account suspended for ${employee.first_name} ${employee.last_name}.`,
            link: `/employee/${employee.id}`,
            relatedEmployeeId: employee.id,
          });
        }
      }

      return { ok: true };
    } else {
      // Log error
      await logForCurrentUser({
        eventType: 'google_account_error',
        entityType: 'Employee',
        entityId: employee.id,
        relatedEmployeeId: employee.id,
        description: `Failed to suspend Google account for ${employee.first_name} ${employee.last_name}: ${result.error}`,
      });
      return { ok: false, error: result.error };
    }
  } catch (error) {
    console.error('Error suspending Google account:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Get offboarding progress
 */
export async function getOffboardingProgress(offboardingId) {
  const tasks = await EmployeeOffboardingTask.filter({ offboarding_id: offboardingId });
  
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const requiredTasks = tasks.filter(t => t.required);
  const requiredCompleted = requiredTasks.filter(t => t.status === 'completed').length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    requiredTotal: requiredTasks.length,
    requiredCompleted,
    requiredPercentage: requiredTasks.length > 0 ? Math.round((requiredCompleted / requiredTasks.length) * 100) : 100,
  };
}

/**
 * Get tasks grouped by role
 */
export async function getOffboardingTasksByRole(offboardingId) {
  const tasks = await EmployeeOffboardingTask.filter({ offboarding_id: offboardingId });
  tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return {
    employee: tasks.filter(t => t.assigned_to_role === 'employee'),
    manager: tasks.filter(t => t.assigned_to_role === 'manager'),
    hr: tasks.filter(t => t.assigned_to_role === 'hr'),
    it: tasks.filter(t => t.assigned_to_role === 'it'),
    finance: tasks.filter(t => t.assigned_to_role === 'finance'),
  };
}

/**
 * Find best matching template for an employee
 */
export async function findOffboardingTemplate(employee, exitType) {
  const templates = await OffboardingTemplate.filter({ active: true });
  
  // Score templates by match quality
  const scored = templates.map(t => {
    let score = 0;
    if (t.entity_id === employee.entity_id) score += 4;
    if (t.department === employee.department_id) score += 2;
    if (t.employment_type === employee.employment_type) score += 2;
    if (t.exit_type === exitType) score += 3;
    if (t.is_default) score += 1;
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.length > 0 ? scored[0].template : null;
}

/**
 * Pause offboarding
 */
export async function pauseOffboarding(offboardingId) {
  await EmployeeOffboarding.update(offboardingId, { status: 'draft' });
}

/**
 * Resume/start offboarding
 */
export async function startOffboarding(offboardingId) {
  await EmployeeOffboarding.update(offboardingId, { status: 'in_progress' });
}

/**
 * Cancel offboarding
 */
export async function cancelOffboarding(offboardingId) {
  const offboardings = await EmployeeOffboarding.filter({ id: offboardingId });
  if (offboardings.length === 0) return;

  const offboarding = offboardings[0];
  const employees = await Employee.filter({ id: offboarding.employee_id });
  const employee = employees[0];

  await EmployeeOffboarding.update(offboardingId, { status: 'cancelled' });
  
  // Restore employee status
  await Employee.update(offboarding.employee_id, { 
    status: 'active',
    termination_date: null,
  });

  // Audit log
  await logForCurrentUser({
    eventType: 'offboarding_cancelled',
    entityType: 'EmployeeOffboarding',
    entityId: offboardingId,
    relatedEmployeeId: offboarding.employee_id,
    description: `Offboarding cancelled for ${employee?.first_name || ''} ${employee?.last_name || ''}`,
  });
}