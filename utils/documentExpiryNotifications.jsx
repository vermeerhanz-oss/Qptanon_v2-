import { base44 } from '@/api/base44Client';
import { sendNotification } from './notifications';
import { format, differenceInDays, parseISO } from 'date-fns';

const Document = base44.entities.Document;
const Employee = base44.entities.Employee;

/**
 * Check for documents expiring within 30 days and send notifications
 * Should be called periodically (e.g., daily via scheduled job or on relevant page loads)
 */
export async function checkDocumentExpiryNotifications() {
  try {
    const [documents, employees] = await Promise.all([
      Document.list(),
      Employee.list(),
    ]);

    const today = new Date();
    const employeeMap = {};
    employees.forEach(e => { employeeMap[e.id] = e; });

    // Find documents expiring within 30 days
    const expiringDocs = documents.filter(doc => {
      if (!doc.expiry_date) return false;
      const expiryDate = parseISO(doc.expiry_date);
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });

    for (const doc of expiringDocs) {
      const employee = employeeMap[doc.owner_employee_id];
      if (!employee) continue;

      const expiryDateFormatted = format(parseISO(doc.expiry_date), 'MMM d, yyyy');
      const link = `EmployeeProfile?id=${employee.id}`;

      // Notify the employee if they have a user_id
      if (employee.user_id) {
        await sendNotification({
          userId: employee.user_id,
          type: 'document_expiring',
          title: 'Document expiring soon',
          message: `${doc.file_name} expires on ${expiryDateFormatted}`,
          link,
          relatedEmployeeId: employee.id,
        });
      }

      // Notify manager if visibility is 'manager' or 'admin'
      if (doc.visibility === 'manager' || doc.visibility === 'admin') {
        if (employee.manager_id) {
          const manager = employeeMap[employee.manager_id];
          if (manager?.user_id) {
            await sendNotification({
              userId: manager.user_id,
              type: 'document_expiring',
              title: 'Team document expiring soon',
              message: `${doc.file_name} for ${employee.first_name} ${employee.last_name} expires on ${expiryDateFormatted}`,
              link,
              relatedEmployeeId: employee.id,
            });
          }
        }
      }

      // Notify admins if visibility is 'admin'
      if (doc.visibility === 'admin') {
        const adminUsers = await base44.entities.User.filter({ role: 'admin' });
        for (const admin of adminUsers) {
          // Skip if admin is the employee or already notified as manager
          if (admin.id === employee.user_id) continue;
          const managerEmployee = employee.manager_id ? employeeMap[employee.manager_id] : null;
          if (managerEmployee?.user_id === admin.id) continue;

          await sendNotification({
            userId: admin.id,
            type: 'document_expiring',
            title: 'Employee document expiring soon',
            message: `${doc.file_name} for ${employee.first_name} ${employee.last_name} expires on ${expiryDateFormatted}`,
            link,
            relatedEmployeeId: employee.id,
          });
        }
      }
    }

    return { checked: expiringDocs.length };
  } catch (error) {
    console.error('Error checking document expiry notifications:', error);
    return { error: error.message };
  }
}

/**
 * Check if a single document is expiring soon (within 30 days)
 * Returns days until expiry or null if not expiring soon
 */
export function getDocumentExpiryStatus(expiryDate) {
  if (!expiryDate) return null;
  
  const today = new Date();
  const expiry = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate;
  const daysUntilExpiry = differenceInDays(expiry, today);
  
  if (daysUntilExpiry < 0) {
    return { status: 'expired', days: Math.abs(daysUntilExpiry) };
  } else if (daysUntilExpiry <= 30) {
    return { status: 'expiring_soon', days: daysUntilExpiry };
  }
  
  return null;
}