import { base44 } from '@/api/base44Client';
import { sendNotification } from '@/components/utils/notifications';
import { format } from 'date-fns';

const EmployeeOnboarding = base44.entities.EmployeeOnboarding;
const EmployeeOnboardingTask = base44.entities.EmployeeOnboardingTask;
const Employee = base44.entities.Employee;

/**
 * Check for overdue onboarding tasks and notify managers.
 * Should be called periodically (e.g., daily or on page load).
 * 
 * @returns {Promise<{checked: number, notified: number}>}
 */
export async function checkOverdueOnboardingTasks() {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Get all in-progress onboardings
  const onboardings = await EmployeeOnboarding.filter({ status: 'in_progress' });
  if (onboardings.length === 0) {
    return { checked: 0, notified: 0 };
  }

  // Get all employees for lookups
  const employees = await Employee.list();
  const employeeMap = new Map(employees.map(e => [e.id, e]));

  let checked = 0;
  let notified = 0;

  for (const onboarding of onboardings) {
    const employee = employeeMap.get(onboarding.employee_id);
    if (!employee) continue;

    const manager = onboarding.manager_id ? employeeMap.get(onboarding.manager_id) : null;
    if (!manager?.user_id) continue;

    // Get tasks for this onboarding
    const tasks = await EmployeeOnboardingTask.filter({ onboarding_id: onboarding.id });
    
    for (const task of tasks) {
      checked++;
      
      // Check if overdue: has due_date, due_date < today, and not completed
      if (task.due_date && task.due_date < today && task.status !== 'completed') {
        try {
          const employeeFullName = `${employee.first_name} ${employee.last_name}`;
          
          await sendNotification({
            userId: manager.user_id,
            type: 'onboarding_task_overdue',
            title: 'Onboarding task overdue',
            message: `${employeeFullName} has an overdue onboarding task: ${task.title}`,
            link: `/onboarding/manage/${onboarding.id}`,
            relatedEmployeeId: employee.id,
            relatedRequestId: task.id,
          });
          notified++;
        } catch (error) {
          console.error('Error sending overdue task notification:', error);
        }
      }
    }
  }

  return { checked, notified };
}