import { base44 } from '@/api/base44Client';
import { parseISO, startOfYear, endOfYear, format } from 'date-fns';

const PublicHoliday = base44.entities.PublicHoliday;
const CompanyEntity = base44.entities.CompanyEntity;

/**
 * Get public holidays applicable to a specific entity for a given year
 * 
 * Holidays are returned if:
 * 1. entity_id matches the given entityId, OR
 * 2. entity_id is null (global/company-wide holiday)
 * 
 * @param {string|null} entityId - The entity ID to filter by (null = global only)
 * @param {number} year - The year to filter by
 * @param {object} options - Additional filter options
 * @param {string} options.stateRegion - Filter by state/region
 * @param {string} options.country - Filter by country
 * @returns {Promise<Array>} - Array of PublicHoliday objects sorted by date
 */
export async function getPublicHolidaysForEntity(entityId, year, options = {}) {
  const { stateRegion, country } = options;
  
  // Build date range for the year
  const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
  
  // Fetch all active holidays
  let allHolidays = await PublicHoliday.filter({ is_active: true });
  
  // Filter by date range
  allHolidays = allHolidays.filter(h => {
    return h.date >= yearStart && h.date <= yearEnd;
  });
  
  // Filter by entity (include global + entity-specific)
  if (entityId) {
    allHolidays = allHolidays.filter(h => !h.entity_id || h.entity_id === entityId);
  } else {
    // If no entityId provided, only return global holidays
    allHolidays = allHolidays.filter(h => !h.entity_id);
  }
  
  // Optional: filter by state/region
  if (stateRegion) {
    allHolidays = allHolidays.filter(h => !h.state_region || h.state_region === stateRegion);
  }
  
  // Optional: filter by country
  if (country) {
    allHolidays = allHolidays.filter(h => !h.country || h.country === country);
  }
  
  // Sort by date
  allHolidays.sort((a, b) => a.date.localeCompare(b.date));
  
  return allHolidays;
}

/**
 * Check if a specific date is a public holiday for an entity
 * 
 * @param {string|null} entityId - The entity ID
 * @param {string|Date} date - The date to check
 * @param {object} options - Additional filter options
 * @returns {Promise<object|null>} - The holiday if found, null otherwise
 */
export async function isPublicHoliday(entityId, date, options = {}) {
  const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  const year = parseInt(dateStr.substring(0, 4));
  
  const holidays = await getPublicHolidaysForEntity(entityId, year, options);
  return holidays.find(h => h.date === dateStr) || null;
}

/**
 * Get all public holidays for a date range (useful for calendars)
 * 
 * @param {string|null} entityId - The entity ID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {object} options - Additional filter options
 * @returns {Promise<Array>} - Array of PublicHoliday objects
 */
export async function getPublicHolidaysInRange(entityId, startDate, endDate, options = {}) {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  
  // Get unique years in range
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  let allHolidays = [];
  for (let year = startYear; year <= endYear; year++) {
    const yearHolidays = await getPublicHolidaysForEntity(entityId, year, options);
    allHolidays = [...allHolidays, ...yearHolidays];
  }
  
  // Filter to exact range
  return allHolidays.filter(h => h.date >= startStr && h.date <= endStr);
}

/**
 * Copy holidays from one year to another (adjusting dates)
 * 
 * @param {number} sourceYear - Year to copy from
 * @param {number} targetYear - Year to copy to
 * @param {string|null} entityId - Entity to copy for (null = global only)
 * @param {string} userId - User performing the copy
 * @returns {Promise<number>} - Number of holidays created
 */
export async function copyHolidaysToYear(sourceYear, targetYear, entityId, userId) {
  const sourceHolidays = await getPublicHolidaysForEntity(entityId, sourceYear);
  
  // Filter to only entity-specific or global based on entityId
  const holidaysToCopy = entityId 
    ? sourceHolidays.filter(h => h.entity_id === entityId)
    : sourceHolidays.filter(h => !h.entity_id);
  
  const yearDiff = targetYear - sourceYear;
  let created = 0;
  
  for (const holiday of holidaysToCopy) {
    const sourceDate = parseISO(holiday.date);
    const targetDate = new Date(sourceDate);
    targetDate.setFullYear(targetDate.getFullYear() + yearDiff);
    
    await PublicHoliday.create({
      entity_id: holiday.entity_id || null,
      country: holiday.country,
      state_region: holiday.state_region,
      date: format(targetDate, 'yyyy-MM-dd'),
      name: holiday.name,
      is_paid: holiday.is_paid,
      is_active: true,
      created_by_user_id: userId,
    });
    created++;
  }
  
  return created;
}