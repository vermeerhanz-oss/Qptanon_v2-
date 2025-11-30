import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Calendar, Sun, Flag, Loader2 } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isWeekend } from 'date-fns';
import { getPublicHolidaysInRange } from '@/components/utils/publicHolidays';

/**
 * Displays a breakdown of leave days showing:
 * - Total days in range
 * - Weekends (non-chargeable)
 * - Public holidays (non-chargeable)
 * - Chargeable leave days
 */
export default function LeaveDayBreakdown({ 
  startDate, 
  endDate, 
  entityId, 
  stateRegion,
  onChargeableDaysChange,
  compact = false 
}) {
  const [breakdown, setBreakdown] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (!startDate || !endDate) {
      setBreakdown(null);
      if (onChargeableDaysChange) onChargeableDaysChange(0);
      return;
    }

    calculateBreakdown();
  }, [startDate, endDate, entityId, stateRegion]);

  const calculateBreakdown = async () => {
    setIsLoading(true);
    try {
      const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
      const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

      // Get all days in range
      const allDays = eachDayOfInterval({ start, end });
      const totalDays = allDays.length;

      // Count weekends
      const weekendDays = allDays.filter(d => isWeekend(d));
      const weekendCount = weekendDays.length;

      // Get public holidays for the range
      const publicHolidays = await getPublicHolidaysInRange(entityId, start, end, { stateRegion });
      setHolidays(publicHolidays);

      // Create a set of holiday date strings for quick lookup
      const holidayDates = new Set(publicHolidays.map(h => h.date));

      // Count public holidays that fall on weekdays (don't double-count weekend holidays)
      const weekdayHolidays = allDays.filter(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return holidayDates.has(dateStr) && !isWeekend(d);
      });
      const holidayCount = weekdayHolidays.length;

      // Chargeable days = total - weekends - weekday public holidays
      const chargeableDays = totalDays - weekendCount - holidayCount;

      const result = {
        totalDays,
        weekendCount,
        holidayCount,
        chargeableDays,
        holidayNames: publicHolidays.map(h => ({ date: h.date, name: h.name })),
      };

      setBreakdown(result);
      if (onChargeableDaysChange) onChargeableDaysChange(chargeableDays);
    } catch (error) {
      console.error('Error calculating leave breakdown:', error);
      setBreakdown(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!startDate || !endDate) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculating...
      </div>
    );
  }

  if (!breakdown) return null;

  if (compact) {
    return (
      <div className="text-sm text-gray-600">
        <span className="font-medium">{breakdown.chargeableDays}</span> chargeable days
        {breakdown.holidayCount > 0 && (
          <span className="text-gray-400 ml-1">
            (excl. {breakdown.holidayCount} public holiday{breakdown.holidayCount > 1 ? 's' : ''})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Calendar className="h-4 w-4" />
        Leave Day Breakdown
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Total days in range:</span>
          <span className="font-medium">{breakdown.totalDays}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 flex items-center gap-1">
            <Sun className="h-3 w-3" /> Weekends:
          </span>
          <span className="text-gray-500">−{breakdown.weekendCount}</span>
        </div>
        {breakdown.holidayCount > 0 && (
          <div className="flex justify-between col-span-2">
            <span className="text-gray-600 flex items-center gap-1">
              <Flag className="h-3 w-3 text-red-500" /> Public holidays:
            </span>
            <span className="text-gray-500">−{breakdown.holidayCount}</span>
          </div>
        )}
      </div>

      {/* Holiday details */}
      {breakdown.holidayNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {breakdown.holidayNames.map((h, i) => (
            <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
              {h.name} ({format(parseISO(h.date), 'dd MMM')})
            </Badge>
          ))}
        </div>
      )}

      <div className="border-t pt-2 flex justify-between items-center">
        <span className="font-medium text-gray-700">Chargeable leave days:</span>
        <span className="text-lg font-bold text-indigo-600">{breakdown.chargeableDays}</span>
      </div>

      <p className="text-xs text-gray-500">
        Only chargeable days will be deducted from your leave balance.
      </p>
    </div>
  );
}

/**
 * Calculate chargeable leave days (excluding weekends and public holidays)
 * Utility function for use in helpers
 */
export async function calculateChargeableDays(startDate, endDate, entityId, stateRegion = null) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  const allDays = eachDayOfInterval({ start, end });
  
  // Get public holidays
  const publicHolidays = await getPublicHolidaysInRange(entityId, start, end, { stateRegion });
  const holidayDates = new Set(publicHolidays.map(h => h.date));

  // Count only weekdays that are not public holidays
  const chargeableDays = allDays.filter(d => {
    if (isWeekend(d)) return false;
    const dateStr = format(d, 'yyyy-MM-dd');
    if (holidayDates.has(dateStr)) return false;
    return true;
  });

  return chargeableDays.length;
}