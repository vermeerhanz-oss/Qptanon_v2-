import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Percent, Calendar } from 'lucide-react';

const EMPLOYMENT_TYPE_LABELS = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  casual: 'Casual',
  contractor: 'Contractor',
};

const DEFAULT_FULL_TIME_HOURS = 38; // AU standard

/**
 * Calculate FTE fraction based on employee hours and policy reference
 */
export function calculateFTE(employee, policy = null) {
  const fullTimeHours = policy?.hours_per_week_reference || DEFAULT_FULL_TIME_HOURS;
  
  // Full-time employees are 1.0 FTE
  if (employee?.employment_type === 'full_time') {
    return {
      fte: 1.0,
      ftePercent: 100,
      hoursPerWeek: employee.hours_per_week || fullTimeHours,
      fullTimeHours,
      isProRata: false,
    };
  }
  
  // Part-time: calculate based on hours_per_week
  if (employee?.employment_type === 'part_time' && employee.hours_per_week) {
    const fte = employee.hours_per_week / fullTimeHours;
    return {
      fte: Math.round(fte * 100) / 100,
      ftePercent: Math.round(fte * 100),
      hoursPerWeek: employee.hours_per_week,
      fullTimeHours,
      isProRata: true,
    };
  }
  
  // Casual or no hours set
  return {
    fte: employee.hours_per_week ? (employee.hours_per_week / fullTimeHours) : null,
    ftePercent: employee.hours_per_week ? Math.round((employee.hours_per_week / fullTimeHours) * 100) : null,
    hoursPerWeek: employee.hours_per_week || null,
    fullTimeHours,
    isProRata: employee?.employment_type === 'part_time',
  };
}

/**
 * Calculate pro-rata annual leave entitlement
 */
export function calculateProRataEntitlement(policy, fteData) {
  if (!policy) return null;
  
  const standardHoursPerDay = policy.standard_hours_per_day || 7.6;
  
  // Get base entitlement in days
  let baseDaysPerYear;
  if (policy.accrual_unit === 'hours_per_year') {
    baseDaysPerYear = policy.accrual_rate / standardHoursPerDay;
  } else if (policy.accrual_unit === 'weeks_per_year') {
    const hoursPerWeek = policy.hours_per_week_reference || DEFAULT_FULL_TIME_HOURS;
    baseDaysPerYear = (policy.accrual_rate * hoursPerWeek) / standardHoursPerDay;
  } else {
    // days_per_year
    baseDaysPerYear = policy.accrual_rate;
  }
  
  const fte = fteData.fte ?? 1;
  const proRataDays = baseDaysPerYear * fte;
  const proRataHours = proRataDays * standardHoursPerDay;
  
  return {
    baseDaysPerYear: Math.round(baseDaysPerYear * 100) / 100,
    baseHoursPerYear: Math.round(baseDaysPerYear * standardHoursPerDay * 100) / 100,
    proRataDays: Math.round(proRataDays * 100) / 100,
    proRataHours: Math.round(proRataHours * 100) / 100,
    standardHoursPerDay,
  };
}

/**
 * Panel showing FTE and pro-rata entitlement information
 * For part-time employees, clearly shows how entitlements are calculated
 */
export default function FTEEntitlementPanel({ 
  employee, 
  policies = [],
  compact = false,
  className = '' 
}) {
  if (!employee) return null;
  
  // Find annual leave policy for this employee
  const annualPolicy = policies.find(p => p.leave_type === 'annual' && p.is_active);
  
  const fteData = calculateFTE(employee, annualPolicy);
  const entitlement = calculateProRataEntitlement(annualPolicy, fteData);
  
  // Don't show for full-time if compact mode
  if (compact && !fteData.isProRata) return null;
  
  // Don't show for casual/contractor without hours
  if (!fteData.hoursPerWeek && employee.employment_type !== 'full_time') {
    if (compact) return null;
    
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span>Employment type: {EMPLOYMENT_TYPE_LABELS[employee.employment_type] || employee.employment_type}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Hours per week not set. Pro-rata calculations unavailable.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 text-sm ${className}`}>
        <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
          {EMPLOYMENT_TYPE_LABELS[employee.employment_type]}
        </Badge>
        {fteData.hoursPerWeek && (
          <span className="text-gray-600">{fteData.hoursPerWeek} hrs/wk</span>
        )}
        {fteData.ftePercent && fteData.ftePercent < 100 && (
          <Badge variant="secondary" className="text-xs">
            {fteData.ftePercent}% FTE
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="h-4 w-4 text-indigo-500" />
          <span className="font-medium text-gray-900">Employment & Entitlements</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Employment Type</p>
            <p className="font-medium text-gray-900">
              {EMPLOYMENT_TYPE_LABELS[employee.employment_type] || employee.employment_type}
            </p>
          </div>
          
          {fteData.hoursPerWeek && (
            <div>
              <p className="text-gray-500 text-xs">Hours per Week</p>
              <p className="font-medium text-gray-900">{fteData.hoursPerWeek}</p>
            </div>
          )}
          
          {fteData.ftePercent !== null && (
            <div>
              <p className="text-gray-500 text-xs">FTE</p>
              <p className="font-medium text-gray-900">{fteData.ftePercent}%</p>
            </div>
          )}

          {fteData.isProRata && fteData.fullTimeHours && (
            <div>
              <p className="text-gray-500 text-xs">Full-time Reference</p>
              <p className="text-gray-600">{fteData.fullTimeHours} hrs/wk</p>
            </div>
          )}
        </div>

        {/* Pro-rata annual leave calculation */}
        {entitlement && fteData.isProRata && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Annual Leave Pro-rata</span>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base entitlement (full-time):</span>
                <span className="font-medium">{entitlement.baseDaysPerYear} days/year</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Your FTE:</span>
                <span className="font-medium">{fteData.ftePercent}%</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                <span className="text-blue-700 font-medium">Your pro-rata entitlement:</span>
                <span className="font-bold text-blue-700">
                  {entitlement.proRataDays} days/year
                  <span className="font-normal text-blue-600 ml-1">
                    (≈ {entitlement.proRataHours} hrs)
                  </span>
                </span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Calculated as: {entitlement.baseDaysPerYear} days × {fteData.ftePercent}% = {entitlement.proRataDays} days
            </p>
          </div>
        )}

        {/* Full-time employees - just show base */}
        {entitlement && !fteData.isProRata && employee.employment_type === 'full_time' && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Annual Leave Entitlement</span>
            </div>
            <p className="text-sm text-gray-600">
              {entitlement.baseDaysPerYear} days per year ({entitlement.baseHoursPerYear} hours)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}