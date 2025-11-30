import { base44 } from '@/api/base44Client';

const LeavePolicy = base44.entities.LeavePolicy;

/**
 * Australian NES-compliant default leave policies
 * These represent minimum entitlements under the National Employment Standards.
 */
const AU_NES_POLICIES = [
  {
    name: 'Annual Leave – Full Time (AU NES)',
    code: 'ANNUAL_FT_AU',
    country: 'AU',
    leave_type: 'annual',
    employment_type_scope: 'full_time',
    accrual_unit: 'weeks_per_year',
    accrual_rate: 4,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    is_default: true,
    is_system: true,
    is_active: true,
    carryover_allowed: true,
    requires_approval: true,
    notes: 'NES minimum: 4 weeks annual leave per year for full-time employees.',
  },
  {
    name: 'Annual Leave – Part Time (AU NES)',
    code: 'ANNUAL_PT_AU',
    country: 'AU',
    leave_type: 'annual',
    employment_type_scope: 'part_time',
    accrual_unit: 'weeks_per_year',
    accrual_rate: 4,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    is_default: true,
    is_system: true,
    is_active: true,
    carryover_allowed: true,
    requires_approval: true,
    notes: 'NES minimum: 4 weeks annual leave per year (pro-rata based on hours worked).',
  },
  {
    name: "Personal/Carer's Leave – Full Time (AU NES)",
    code: 'PERSONAL_FT_AU',
    country: 'AU',
    leave_type: 'personal',
    employment_type_scope: 'full_time',
    accrual_unit: 'days_per_year',
    accrual_rate: 10,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    is_default: true,
    is_system: true,
    is_active: true,
    carryover_allowed: true,
    requires_approval: true,
    notes: "NES minimum: 10 days personal/carer's leave per year for full-time employees.",
  },
  {
    name: "Personal/Carer's Leave – Part Time (AU NES)",
    code: 'PERSONAL_PT_AU',
    country: 'AU',
    leave_type: 'personal',
    employment_type_scope: 'part_time',
    accrual_unit: 'days_per_year',
    accrual_rate: 10,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    is_default: true,
    is_system: true,
    is_active: true,
    carryover_allowed: true,
    requires_approval: true,
    notes: "NES minimum: 10 days personal/carer's leave per year (pro-rata based on hours worked).",
  },
];

/**
 * Ensure Australian NES-compliant default leave policies exist.
 * This function is idempotent - safe to call multiple times.
 * 
 * @returns {Promise<{created: number, existing: number, errors: string[]}>}
 */
export async function ensureDefaultAustralianLeavePolicies() {
  const results = { created: 0, existing: 0, errors: [] };

  try {
    // Fetch all existing policies
    const existingPolicies = await LeavePolicy.list();

    for (const policyDef of AU_NES_POLICIES) {
      // Check if policy already exists by code + country
      const existing = existingPolicies.find(
        p => p.code === policyDef.code && p.country === policyDef.country
      );

      if (existing) {
        results.existing++;
        // Optionally update is_system flag if not set
        if (!existing.is_system) {
          try {
            await LeavePolicy.update(existing.id, { is_system: true });
          } catch (updateErr) {
            console.warn(`Could not update is_system for ${policyDef.code}:`, updateErr);
          }
        }
      } else {
        // Create the policy
        try {
          await LeavePolicy.create(policyDef);
          results.created++;
        } catch (createErr) {
          results.errors.push(`Failed to create ${policyDef.code}: ${createErr.message}`);
        }
      }
    }
  } catch (err) {
    results.errors.push(`Error loading policies: ${err.message}`);
  }

  return results;
}

/**
 * Get all system NES policies for Australia
 */
export async function getSystemAustraliaPolicies() {
  const policies = await LeavePolicy.filter({ country: 'AU', is_system: true });
  return policies;
}