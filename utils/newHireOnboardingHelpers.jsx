/**
 * New Hire Onboarding Helpers
 * 
 * Central module for creating a new hire from the wizard.
 * Creates Employee, compensation, onboarding records.
 */

import { base44 } from '@/api/base44Client';
import { createEmployeeOnboarding } from '@/components/onboarding/onboardingEngine';
import { initializeLeaveBalances } from '@/components/utils/leaveBalanceInit';
import { logForCurrentUser } from '@/components/utils/audit';
import { format } from 'date-fns';

const Employee = base44.entities.Employee;

/**
 * Create a new hire from the wizard data
 * 
 * @param {Object} newHire - Combined wizard data
 * @returns {Promise<{success: boolean, employee_id?: string, error?: string}>}
 */
export async function createNewHireFromWizard(newHire) {
  try {
    // 1. Create Employee record
    const employeeData = buildEmployeeRecord(newHire);
    const employee = await Employee.create(employeeData);

    // 2. Initialize leave balances
    const startDate = newHire.personal.start_date || format(new Date(), 'yyyy-MM-dd');
    await initializeLeaveBalances(employee.id, startDate);

    // 3. Create Onboarding if template selected
    if (newHire.onboarding?.onboarding_template_id) {
      await createEmployeeOnboarding({
        employeeId: employee.id,
        templateId: newHire.onboarding.onboarding_template_id,
        startDate: startDate,
        entityId: newHire.employment?.entity_id || null,
        department: newHire.personal?.department_id || null,
        managerId: newHire.personal?.manager_id || null,
        notes: newHire.onboarding?.notes || null,
      });
    } else {
      // No template, just set status to active
      await Employee.update(employee.id, { status: 'active' });
    }

    // 4. Audit log
    await logForCurrentUser({
      eventType: 'employee_created',
      entityType: 'Employee',
      entityId: employee.id,
      relatedEmployeeId: employee.id,
      description: `Created new hire: ${employee.first_name} ${employee.last_name} (${employee.job_title})`,
      metadata: {
        employment_type: employee.employment_type,
        entity_id: employee.entity_id,
        start_date: startDate,
      },
    });

    return { success: true, employee_id: employee.id };
  } catch (error) {
    console.error('Error creating new hire:', error);
    return { success: false, error: error.message || 'Failed to create new hire' };
  }
}

/**
 * Build the employee record from wizard data
 */
function buildEmployeeRecord(newHire) {
  const personal = newHire.personal || {};
  const employment = newHire.employment || {};
  const compensation = newHire.compensation || {};

  // Build work email from personal email if not provided
  const workEmail = personal.work_email || personal.personal_email;

  // Build variable_comp object for bonuses/commission
  const variableComp = {};
  if (compensation.has_commission) {
    variableComp.commission = {
      has_commission: true,
      commission_target: compensation.commission_target || null,
      commission_notes: compensation.commission_notes || null,
    };
  }
  if (compensation.has_annual_bonus) {
    variableComp.annual_bonus = {
      has_bonus: true,
      target_amount: compensation.bonus_target_amount || null,
      bonus_notes: compensation.bonus_notes || null,
    };
  }

  const record = {
    // Personal info
    first_name: personal.first_name,
    last_name: personal.last_name,
    personal_email: personal.personal_email || null,
    email: workEmail,
    phone: personal.phone || null,

    // Role & reporting
    job_title: personal.job_title,
    manager_id: personal.manager_id || null,
    department_id: personal.department_id || null,
    location_id: personal.location_id || null,

    // Employment details
    entity_id: employment.entity_id || null,
    employment_type: employment.employment_type || 'full_time',
    hours_per_week: employment.hours_per_week || 38,
    employment_agreement_id: employment.employment_agreement_id || null,

    // Dates
    start_date: personal.start_date || null,
    service_start_date: personal.start_date || null,
    entity_start_date: personal.start_date || null,

    // Compensation
    base_salary: compensation.base_amount || null,
    salary_currency: compensation.currency || 'AUD',
    pay_cycle: compensation.pay_frequency || 'monthly',
    variable_comp: Object.keys(variableComp).length > 0 ? variableComp : null,

    // Status
    status: 'onboarding',

    // Notes
    notes: newHire.onboarding?.notes || null,
  };

  return record;
}

/**
 * Calculate FTE from hours per week
 */
export function calculateFTE(hoursPerWeek, standardFullTimeHours = 38) {
  if (!hoursPerWeek || hoursPerWeek <= 0) return 0;
  return Math.round((hoursPerWeek / standardFullTimeHours) * 100) / 100;
}

/**
 * Calculate hours from FTE
 */
export function calculateHoursFromFTE(fte, standardFullTimeHours = 38) {
  if (!fte || fte <= 0) return 0;
  return Math.round(fte * standardFullTimeHours * 10) / 10;
}

/**
 * Validate wizard step data
 */
export function validateStep(step, data) {
  const errors = {};

  switch (step) {
    case 1: // Personal & Role
      if (!data.personal?.first_name?.trim()) {
        errors.first_name = 'First name is required';
      }
      if (!data.personal?.last_name?.trim()) {
        errors.last_name = 'Last name is required';
      }
      if (!data.personal?.job_title?.trim()) {
        errors.job_title = 'Job title is required';
      }
      if (!data.personal?.start_date) {
        errors.start_date = 'Start date is required';
      }
      break;

    case 2: // Employment Setup
      if (!data.employment?.entity_id) {
        errors.entity_id = 'Legal entity is required';
      }
      if (!data.employment?.employment_type) {
        errors.employment_type = 'Employment type is required';
      }
      if (!data.employment?.hours_per_week || data.employment.hours_per_week <= 0) {
        errors.hours_per_week = 'Working hours are required';
      }
      break;

    case 3: // Compensation
      if (!data.compensation?.pay_type) {
        errors.pay_type = 'Pay type is required';
      }
      if (!data.compensation?.base_amount || data.compensation.base_amount <= 0) {
        errors.base_amount = 'Base pay amount is required';
      }
      break;

    case 4: // Onboarding
      // No required fields, but recommend template
      break;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}