import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Info, Loader2 } from 'lucide-react';
import { getLeaveBalancesForEmployee } from '@/components/utils/leaveBalanceService';
import { formatDays, formatHours, safeNumber } from '@/components/utils/numberUtils';

/**
 * Leave Balance Tiles Component
 * 
 * Displays leave balances for an employee using the unified leaveBalanceService.
 * Used by dashboard and My Leave page for consistent balance display.
 * 
 * Testing scenarios (encoded as comments):
 * - Scenario A: No leave booked, 6 months of service
 *   Annual `available` should match ~6 months of accrual from service_start_date
 * - Scenario B: Employee has 10 days approved annual leave
 *   `accrued` reflects total service, `used` includes those 10 days
 *   `available` = accrued - used
 * - Scenario C: Employee has PENDING leave
 *   Pending amount is treated as reserved and deducted from `available`
 */

export default function LeaveBalanceTiles({ 
  employeeId, 
  refreshKey = 0,
  compact = false,
  showLongService = true 
}) {
  const [balances, setBalances] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (employeeId) {
      loadBalances();
    }
  }, [employeeId, refreshKey]);

  const loadBalances = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLeaveBalancesForEmployee(employeeId);
      if (result.error) {
        setError(result.error);
      } else {
        setBalances(result);
      }
    } catch (err) {
      console.error('Error loading leave balances:', err);
      setError(err.message || 'Failed to load balances');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        {error}
      </div>
    );
  }

  if (!balances) {
    return null;
  }

  const categories = [
    { key: 'annual', title: 'Annual Leave' },
    { key: 'personal', title: 'Personal/Sick Leave' },
    ...(showLongService ? [{ key: 'long_service', title: 'Long Service Leave' }] : []),
  ];

  if (compact) {
    return (
      <div className="space-y-3">
        {categories.map(cat => {
          const balance = balances[cat.key];
          if (!balance) return null;
          
          const stdHours = balance.standardHoursPerDay || 7.6;
          const availableDays = safeNumber(balance.available / stdHours, 0);
          
          return (
            <div key={cat.key} className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">{cat.title}:</span>
              <span className="font-semibold text-gray-900">
                {formatDays(availableDays)} days 
                <span className="text-gray-500 font-normal ml-1">
                  ({formatHours(balance.available)} hrs)
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {categories.map(cat => (
        <LeaveBalanceTile 
          key={cat.key}
          title={cat.title}
          balance={balances[cat.key]}
        />
      ))}
    </div>
  );
}

function LeaveBalanceTile({ title, balance }) {
  if (!balance) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No balance record</p>
        </CardContent>
      </Card>
    );
  }

  const stdHours = balance.standardHoursPerDay || 7.6;
  const availableDays = safeNumber(balance.available / stdHours, 0);
  const accruedHours = safeNumber(balance.accrued, 0);
  const usedHours = safeNumber(balance.used, 0);
  const openingHours = safeNumber(balance.openingBalance, 0);
  const adjustedHours = safeNumber(balance.adjusted, 0);
  const pendingHours = safeNumber(balance.usedPending, 0);
  const approvedHours = safeNumber(balance.usedApproved, 0);

  // Handle LSL not eligible
  if (!balance.eligible && balance.message) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-500">
            <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <span>{balance.message}</span>
          </div>
          {balance.eligibilityDate && (
            <p className="text-xs text-gray-400 mt-2">
              Eligible from: {balance.eligibilityDate}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          <Clock className="h-4 w-4 text-gray-400" />
        </div>
        
        <p className="text-2xl font-bold text-gray-900">{formatDays(availableDays)} days</p>
        <p className="text-sm text-gray-500 mb-3">{formatHours(balance.available)} hours available</p>
        
        {/* Breakdown */}
        <div className="border-t pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Accrued</span>
            <span className="text-gray-700">{formatHours(accruedHours)}h</span>
          </div>
          {openingHours > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Opening balance</span>
              <span className="text-gray-700">+{formatHours(openingHours)}h</span>
            </div>
          )}
          {adjustedHours !== 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Adjustments</span>
              <span className="text-gray-700">{adjustedHours >= 0 ? '+' : ''}{formatHours(adjustedHours)}h</span>
            </div>
          )}
          {usedHours > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Used (approved{pendingHours > 0 ? ' + pending' : ''})</span>
              <span className="text-red-600">−{formatHours(usedHours)}h</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}