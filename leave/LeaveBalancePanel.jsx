import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus, Minus, AlertCircle, Percent } from 'lucide-react';
import { hoursToDays } from '@/components/utils/leaveAccrual';
import { formatDays, formatHours, safeNumber } from '@/components/utils/numberUtils';
import { format, addYears, parseISO } from 'date-fns';
import { calculateFTE, calculateProRataEntitlement } from './FTEEntitlementPanel';

const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave',
  personal: 'Personal/Carer\'s',
  sick: 'Sick Leave',
  long_service: 'Long Service',
  parental: 'Parental Leave',
  compassionate: 'Compassionate',
  other: 'Other Leave',
};

const LEAVE_TYPE_COLORS = {
  annual: 'bg-blue-50 border-blue-200',
  personal: 'bg-purple-50 border-purple-200',
  sick: 'bg-red-50 border-red-200',
  long_service: 'bg-amber-50 border-amber-200',
  parental: 'bg-pink-50 border-pink-200',
  compassionate: 'bg-gray-50 border-gray-200',
  other: 'bg-slate-50 border-slate-200',
};

const LEAVE_TYPE_ICON_COLORS = {
  annual: 'text-blue-500',
  personal: 'text-purple-500',
  sick: 'text-red-500',
  long_service: 'text-amber-500',
  parental: 'text-pink-500',
  compassionate: 'text-gray-500',
  other: 'text-slate-500',
};

/**
 * Display leave balances for an employee
 * Shows available hours/days, accrued, and any adjustments
 * For Long Service Leave, shows eligibility status if not yet eligible
 */
export default function LeaveBalancePanel({ 
  balances = [], 
  policies = [],
  employee = null,
  compact = false,
  showFTEInfo = true,
  className = '' 
}) {
  if (balances.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-gray-500">
          <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p>No leave balances configured</p>
        </CardContent>
      </Card>
    );
  }

  // Get standard hours from first matching policy, default to 7.6
  const getStandardHours = (leaveType) => {
    const policy = policies.find(p => p.leave_type === leaveType);
    return policy?.standard_hours_per_day || 7.6;
  };

  const formatHoursAsDays = (hours, leaveType) => {
    const standardHours = getStandardHours(leaveType);
    return safeNumber(hoursToDays(safeNumber(hours, 0), standardHours), 0);
  };

  // Calculate FTE info for part-time employees
  const annualPolicy = policies.find(p => p.leave_type === 'annual' && p.is_active);
  const fteData = employee ? calculateFTE(employee, annualPolicy) : null;
  const proRataEntitlement = fteData && annualPolicy ? calculateProRataEntitlement(annualPolicy, fteData) : null;
  const isPartTime = employee?.employment_type === 'part_time';

  // Check LSL eligibility for the employee
  const getLSLEligibility = () => {
    const lslPolicy = policies.find(p => p.leave_type === 'long_service' && p.is_active);
    if (!lslPolicy || !lslPolicy.min_service_years_before_accrual) return null;
    
    const serviceStartDate = employee?.service_start_date || employee?.start_date;
    if (!serviceStartDate) return null;
    
    const startDate = parseISO(serviceStartDate);
    const now = new Date();
    const yearsOfService = (now - startDate) / (365 * 24 * 60 * 60 * 1000);
    const minYears = lslPolicy.min_service_years_before_accrual;
    
    if (yearsOfService < minYears) {
      const eligibilityDate = addYears(startDate, minYears);
      return {
        eligible: false,
        yearsOfService: Math.round(yearsOfService * 10) / 10,
        minYears,
        eligibilityDate: format(eligibilityDate, 'dd MMM yyyy'),
        policy: lslPolicy
      };
    }
    
    return { eligible: true, yearsOfService: Math.round(yearsOfService * 10) / 10 };
  };

  const lslEligibility = getLSLEligibility();

  // Check if we should show LSL not-yet-eligible card
  const hasLSLBalance = balances.some(b => b.leave_type === 'long_service');
  const showLSLNotEligible = lslEligibility && !lslEligibility.eligible && !hasLSLBalance;

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        {/* FTE indicator for part-time in compact mode */}
        {showFTEInfo && isPartTime && fteData?.ftePercent && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
              Part-time
            </Badge>
            <span>{fteData.hoursPerWeek} hrs/wk</span>
            <span>•</span>
            <span>{fteData.ftePercent}% FTE</span>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {balances.map((bal) => (
            <div 
              key={bal.id} 
              className={`p-3 rounded-lg border ${LEAVE_TYPE_COLORS[bal.leave_type] || LEAVE_TYPE_COLORS.other}`}
            >
              <p className="text-xs text-gray-600 truncate">
                {LEAVE_TYPE_LABELS[bal.leave_type] || bal.leave_type}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {formatHoursAsDays(bal.available_hours || 0, bal.leave_type)}
                <span className="text-xs font-normal text-gray-500 ml-1">days</span>
              </p>
            </div>
          ))}
          {showLSLNotEligible && (
            <div className={`p-3 rounded-lg border ${LEAVE_TYPE_COLORS.long_service} opacity-60`}>
              <p className="text-xs text-gray-600 truncate">Long Service</p>
              <p className="text-xs text-amber-600 mt-1">
                Eligible: {lslEligibility.eligibilityDate}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            Leave Balances
          </CardTitle>
          {/* FTE badge for part-time */}
          {showFTEInfo && isPartTime && fteData?.ftePercent && (
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
              <Percent className="h-3 w-3 mr-1" />
              {fteData.ftePercent}% FTE
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* FTE and pro-rata info panel for part-time employees */}
        {showFTEInfo && isPartTime && fteData?.hoursPerWeek && proRataEntitlement && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Part-time Pro-rata Entitlements</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-blue-600">Hours/week:</span>
                <span className="font-medium text-blue-800 ml-1">{fteData.hoursPerWeek}</span>
              </div>
              <div>
                <span className="text-blue-600">FTE:</span>
                <span className="font-medium text-blue-800 ml-1">{fteData.ftePercent}%</span>
              </div>
              <div>
                <span className="text-blue-600">Base annual:</span>
                <span className="font-medium text-blue-800 ml-1">{proRataEntitlement.baseDaysPerYear} days</span>
              </div>
              <div>
                <span className="text-blue-600">Your entitlement:</span>
                <span className="font-bold text-blue-800 ml-1">{proRataEntitlement.proRataDays} days</span>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((bal) => {
            const standardHours = getStandardHours(bal.leave_type);
            const availableDays = formatHoursAsDays(bal.available_hours || 0, bal.leave_type);
            const accruedDays = formatHoursAsDays(bal.accrued_hours || 0, bal.leave_type);
            const takenDays = formatHoursAsDays(bal.taken_hours || 0, bal.leave_type);
            const adjustedDays = formatHoursAsDays(bal.adjusted_hours || 0, bal.leave_type);
            const openingDays = formatHoursAsDays(bal.opening_balance_hours || 0, bal.leave_type);

            return (
              <div 
                key={bal.id} 
                className={`p-4 rounded-lg border ${LEAVE_TYPE_COLORS[bal.leave_type] || LEAVE_TYPE_COLORS.other}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-gray-900">
                    {LEAVE_TYPE_LABELS[bal.leave_type] || bal.leave_type}
                  </p>
                  <Clock className={`h-4 w-4 ${LEAVE_TYPE_ICON_COLORS[bal.leave_type] || 'text-gray-400'}`} />
                </div>
                
                {/* Available balance - prominent display */}
                <div className="mb-3">
                  <p className="text-3xl font-bold text-gray-900">
                    {availableDays}
                    <span className="text-sm font-normal text-gray-500 ml-1">days</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatHours(safeNumber(bal.available_hours, 0))} hours available
                  </p>
                </div>

                {/* Breakdown */}
                <div className="space-y-1 text-xs text-gray-600 border-t pt-2">
                  {openingDays > 0 && (
                    <div className="flex justify-between">
                      <span>Opening balance</span>
                      <span>{openingDays} days</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Accrued</span>
                    <span className="text-green-600">+{accruedDays} days</span>
                  </div>
                  {takenDays > 0 && (
                    <div className="flex justify-between">
                      <span>Taken</span>
                      <span className="text-red-600">−{takenDays} days</span>
                    </div>
                  )}
                  {adjustedDays !== 0 && (
                    <div className="flex justify-between">
                      <span>Adjustments</span>
                      <span className={adjustedDays > 0 ? 'text-green-600' : 'text-red-600'}>
                        {adjustedDays > 0 ? '+' : ''}{adjustedDays} days
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Long Service Leave - Not Yet Eligible */}
          {showLSLNotEligible && (
            <div className={`p-4 rounded-lg border ${LEAVE_TYPE_COLORS.long_service} opacity-75`}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-gray-900">Long Service Leave</p>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              
              <div className="mb-3">
                <p className="text-sm font-medium text-amber-700">Not yet eligible</p>
                <p className="text-xs text-gray-600 mt-1">
                  {lslEligibility.minYears} years of service required
                </p>
              </div>

              <div className="space-y-1 text-xs text-gray-600 border-t pt-2">
                <div className="flex justify-between">
                  <span>Current service</span>
                  <span>{lslEligibility.yearsOfService} years</span>
                </div>
                <div className="flex justify-between">
                  <span>Eligible from</span>
                  <span className="font-medium text-amber-600">{lslEligibility.eligibilityDate}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline balance display for use in leave request lists
 */
export function InlineLeaveBalance({ balance, policies = [] }) {
  if (!balance) return null;
  
  const policy = policies.find(p => p.leave_type === balance.leave_type);
  const standardHours = policy?.standard_hours_per_day || 7.6;
  const availableDays = safeNumber(hoursToDays(safeNumber(balance.available_hours, 0), standardHours), 0);
  
  return (
    <Badge variant="outline" className="text-xs">
      {availableDays} days available
    </Badge>
  );
}