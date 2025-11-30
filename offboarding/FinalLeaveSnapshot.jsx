import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { getLeaveContextForEmployee } from '@/components/utils/LeaveEngine';
import { hoursToDays } from '@/components/utils/leaveAccrual';
import { formatDays, formatHours, safeNumber } from '@/components/utils/numberUtils';

/**
 * Displays a read-only snapshot of an employee's final leave balances
 * Used in offboarding flows to show what leave entitlements remain
 */
export default function FinalLeaveSnapshot({ 
  employeeId, 
  asOfDate = new Date(),
  className = '' 
}) {
  const [leaveContext, setLeaveContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      loadLeaveData();
    }
  }, [employeeId]);

  const loadLeaveData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getLeaveContextForEmployee(employeeId, asOfDate);
      setLeaveContext(ctx);
    } catch (error) {
      console.error('Error loading leave context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!leaveContext) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-gray-500">
          Unable to load leave balances
        </CardContent>
      </Card>
    );
  }

  const { balances, policies, employeeContext } = leaveContext;
  const employee = employeeContext?.employee;

  const getBalanceDisplay = (balance, policy, label) => {
    if (!balance) return null;
    
    const standardHours = policy?.standard_hours_per_day || 7.6;
    const availableHours = safeNumber(balance.available_hours, 0);
    const availableDays = safeNumber(hoursToDays(availableHours, standardHours), 0);

    return {
      label,
      hours: formatHours(availableHours),
      days: formatDays(availableDays),
    };
  };

  // Check LSL eligibility
  const lslPolicy = policies?.long_service;
  const lslBalance = balances?.long_service;
  let lslEligible = true;
  let lslMessage = null;

  if (lslPolicy?.min_service_years_before_accrual && employee) {
    const serviceStart = employee.service_start_date || employee.start_date;
    if (serviceStart) {
      const yearsOfService = (Date.now() - new Date(serviceStart).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (yearsOfService < lslPolicy.min_service_years_before_accrual) {
        lslEligible = false;
        lslMessage = `Not eligible (${lslPolicy.min_service_years_before_accrual} years required)`;
      }
    }
  }

  const balanceItems = [
    getBalanceDisplay(balances?.annual, policies?.annual, 'Annual Leave'),
    getBalanceDisplay(balances?.personal, policies?.personal, 'Personal/Sick Leave'),
  ].filter(Boolean);

  const lslDisplay = lslBalance && lslEligible
    ? getBalanceDisplay(lslBalance, lslPolicy, 'Long Service Leave')
    : null;

  const dateDisplay = typeof asOfDate === 'string' ? asOfDate : format(asOfDate, 'dd MMM yyyy');

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-indigo-600" />
            Final Leave Balances
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            As of {dateDisplay}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {balanceItems.map((item, idx) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{item.days} days</p>
              <p className="text-xs text-gray-500">{item.hours} hours</p>
            </div>
          ))}
        </div>

        {/* Long Service Leave */}
        {lslPolicy && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Long Service Leave</span>
            </div>
            {lslDisplay ? (
              <>
                <p className="text-xl font-bold text-gray-900">{lslDisplay.days} days</p>
                <p className="text-xs text-gray-500">{lslDisplay.hours} hours</p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Info className="h-4 w-4 text-blue-500" />
                <span>{lslMessage || 'Not yet eligible'}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Info className="h-3 w-3" />
          This is a read-only snapshot. Balances may be subject to final payroll adjustments.
        </p>
      </CardContent>
    </Card>
  );
}