import { base44 } from '@/api/base44Client';

const UserNotificationPreferences = base44.entities.UserNotificationPreferences;

const DEFAULT_PREFS = {
  email_leave_requests: true,
  email_leave_approvals: true,
  email_leave_declines: true,
  email_new_documents: true,
  email_new_tasks: true,
  email_system_announcements: true,
  inapp_leave_requests: true,
  inapp_leave_approvals: true,
  inapp_leave_declines: true,
  inapp_new_documents: true,
  inapp_new_tasks: true,
  inapp_system_announcements: true,
};

/**
 * Get notification preferences for a user.
 * Falls back to DEFAULT_PREFS if none are stored.
 */
export async function getNotificationPreferences(userId) {
  const prefs = await UserNotificationPreferences.filter({ user_id: userId });

  if (prefs.length === 0) {
    // No record yet → default-on for all categories
    return { ...DEFAULT_PREFS };
  }

  const stored = prefs[0];
  // Keep it simple: rely on key lookup + !== false behaviour
  return stored;
}

/**
 * Check if user wants email notifications for a specific category.
 *
 * @param {string} userId - The user ID
 * @param {string} category - One of:
 *   'leave_requests', 'leave_approvals', 'leave_declines',
 *   'new_documents', 'new_tasks', 'system_announcements'
 * @returns {Promise<boolean>} Whether email notification is enabled
 */
export async function shouldSendEmail(userId, category) {
  const prefs = await getNotificationPreferences(userId);
  const key = `email_${category}`;
  // Default-on: only explicit false disables
  return prefs[key] !== false;
}

/**
 * Check if user wants in-app notifications for a specific category.
 *
 * @param {string} userId - The user ID
 * @param {string} category - One of:
 *   'leave_requests', 'leave_approvals', 'leave_declines',
 *   'new_documents', 'new_tasks', 'system_announcements'
 * @returns {Promise<boolean>} Whether in-app notification is enabled
 */
export async function shouldSendInApp(userId, category) {
  const prefs = await getNotificationPreferences(userId);
  const key = `inapp_${category}`;
  // Default-on: only explicit false disables
  return prefs[key] !== false;
}

/**
 * Notification categories enum for type safety.
 */
export const NotificationCategory = {
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_APPROVALS: 'leave_approvals',
  LEAVE_DECLINES: 'leave_declines',
  NEW_DOCUMENTS: 'new_documents',
  NEW_TASKS: 'new_tasks',
  SYSTEM_ANNOUNCEMENTS: 'system_announcements',
};
