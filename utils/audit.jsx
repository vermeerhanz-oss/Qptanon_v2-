import { base44 } from '@/api/base44Client';

const AuditEvent = base44.entities.AuditEvent;

/**
 * Log an audit event to track important changes in the HRIS
 * 
 * @param {Object} params
 * @param {string} params.actorUserId - User ID of who performed the action
 * @param {string} [params.actorEmployeeId] - Employee ID of actor (optional)
 * @param {string} params.eventType - Type of event (e.g. 'employee_created', 'leave_approved')
 * @param {string} params.entityType - Entity type (e.g. 'Employee', 'LeaveRequest', 'Document')
 * @param {string} params.entityId - ID of the affected record
 * @param {string} [params.relatedEmployeeId] - Employee this event is about (optional)
 * @param {string} params.description - Human-readable summary
 * @param {Object} [params.metadata] - Optional structured data { before: {}, after: {} }
 */
export async function logAuditEvent({
  actorUserId,
  actorEmployeeId,
  eventType,
  entityType,
  entityId,
  relatedEmployeeId,
  description,
  metadata,
}) {
  try {
    const eventData = {
      actor_user_id: actorUserId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      description,
      created_at: new Date().toISOString(),
    };

    if (actorEmployeeId) {
      eventData.actor_employee_id = actorEmployeeId;
    }

    if (relatedEmployeeId) {
      eventData.related_employee_id = relatedEmployeeId;
    }

    if (metadata) {
      // Keep metadata lightweight - only store changed fields
      eventData.metadata = metadata;
    }

    await AuditEvent.create(eventData);
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - audit logging should not break main operations
  }
}

/**
 * Log an audit event for the current logged-in user
 * Automatically looks up user and employee context
 * 
 * @param {Object} params
 * @param {string} params.eventType - Type of event
 * @param {string} params.entityType - Entity type
 * @param {string} params.entityId - ID of the affected record
 * @param {string} [params.relatedEmployeeId] - Employee this event is about (optional)
 * @param {string} params.description - Human-readable summary
 * @param {Object} [params.metadata] - Optional structured data
 */
export async function logForCurrentUser({
  eventType,
  entityType,
  entityId,
  relatedEmployeeId,
  description,
  metadata,
}) {
  try {
    const user = await base44.auth.me();
    
    // Try to find employee record for current user
    let actorEmployeeId = null;
    try {
      const employees = await base44.entities.Employee.filter({ user_id: user.id });
      if (employees.length > 0) {
        actorEmployeeId = employees[0].id;
      }
    } catch (e) {
      // Employee lookup failed, continue without it
    }

    await logAuditEvent({
      actorUserId: user.id,
      actorEmployeeId,
      eventType,
      entityType,
      entityId,
      relatedEmployeeId,
      description,
      metadata,
    });
  } catch (error) {
    console.error('Error logging audit event for current user:', error);
  }
}