/**
 * Employee Duplicate Detection Utility
 * 
 * Provides functions to detect potential duplicate employee records
 * based on email, personal email, and phone+lastName combinations.
 */

import { base44 } from '@/api/base44Client';

const Employee = base44.entities.Employee;

/**
 * Find potential duplicate employees based on provided criteria
 * 
 * @param {Object} input - Search criteria
 * @param {string} [input.email] - Work email to check
 * @param {string} [input.personalEmail] - Personal email to check
 * @param {string} [input.phone] - Phone number to check
 * @param {string} [input.lastName] - Last name to check (used with phone)
 * @param {string} [input.excludeId] - Employee ID to exclude from results (for updates)
 * @returns {Promise<Array>} Array of matching employees with matchType and statusCategory
 */
export async function findPotentialDuplicates({ email, personalEmail, phone, lastName, excludeId }) {
  const matches = [];
  const seenIds = new Set();

  // Normalize inputs
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPersonalEmail = personalEmail?.trim().toLowerCase();
  const normalizedPhone = phone?.trim().replace(/\D/g, ''); // Remove non-digits
  const normalizedLastName = lastName?.trim().toLowerCase();

  // Fetch all employees once for efficiency
  const allEmployees = await Employee.list();

  for (const emp of allEmployees) {
    // Skip the employee being updated
    if (excludeId && emp.id === excludeId) continue;
    
    // Skip already matched employees
    if (seenIds.has(emp.id)) continue;

    const empEmail = emp.email?.trim().toLowerCase();
    const empPersonalEmail = emp.personal_email?.trim().toLowerCase();
    const empPhone = emp.phone?.trim().replace(/\D/g, '');
    const empLastName = emp.last_name?.trim().toLowerCase();

    const statusCategory = emp.status === 'terminated' ? 'terminated' : 'active';

    // Check work email match
    if (normalizedEmail && empEmail && normalizedEmail === empEmail) {
      seenIds.add(emp.id);
      matches.push({
        ...emp,
        matchType: 'hard_email',
        statusCategory,
      });
      continue;
    }

    // Check personal email match
    if (normalizedPersonalEmail && empPersonalEmail && normalizedPersonalEmail === empPersonalEmail) {
      seenIds.add(emp.id);
      matches.push({
        ...emp,
        matchType: 'hard_personal_email',
        statusCategory,
      });
      continue;
    }

    // Check phone + lastName match
    if (normalizedPhone && normalizedLastName && empPhone && empLastName) {
      if (normalizedPhone === empPhone && normalizedLastName === empLastName) {
        seenIds.add(emp.id);
        matches.push({
          ...emp,
          matchType: 'hard_phone_lastname',
          statusCategory,
        });
        continue;
      }
    }
  }

  return matches;
}

/**
 * Classify the duplicate scenario based on matches
 * 
 * @param {Object} input - The input that was checked (unused but kept for context)
 * @param {Array} matches - Array of matches from findPotentialDuplicates
 * @returns {string} Scenario classification:
 *   - 'no_match' - No duplicates found
 *   - 'hard_match_active' - One match found, employee is active
 *   - 'hard_match_terminated' - One match found, employee is terminated
 *   - 'multiple_matches' - Multiple potential duplicates found
 */
export function classifyDuplicateScenario(input, matches) {
  if (!matches || matches.length === 0) {
    return 'no_match';
  }

  if (matches.length > 1) {
    return 'multiple_matches';
  }

  // Single match
  const match = matches[0];
  if (match.statusCategory === 'terminated') {
    return 'hard_match_terminated';
  }

  return 'hard_match_active';
}

/**
 * Get a human-readable description of a match type
 * 
 * @param {string} matchType - The match type from findPotentialDuplicates
 * @returns {string} Human-readable description
 */
export function getMatchTypeLabel(matchType) {
  const labels = {
    hard_email: 'Work email match',
    hard_personal_email: 'Personal email match',
    hard_phone_lastname: 'Phone + last name match',
  };
  return labels[matchType] || 'Unknown match';
}

/**
 * Get a human-readable description of a scenario
 * 
 * @param {string} scenario - The scenario from classifyDuplicateScenario
 * @returns {string} Human-readable description
 */
export function getScenarioDescription(scenario) {
  const descriptions = {
    no_match: 'No existing employee matches this information.',
    hard_match_active: 'An active employee with matching information already exists.',
    hard_match_terminated: 'A terminated employee with matching information was found.',
    multiple_matches: 'Multiple employees with matching information were found.',
  };
  return descriptions[scenario] || 'Unknown scenario';
}