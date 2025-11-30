import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Users, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

/**
 * Displays staffing conflict warnings for leave approval
 */
export default function StaffingConflictWarning({ 
  conflictResult, 
  overlappingEmployees = [],
  className = '' 
}) {
  if (!conflictResult?.hasConflict) return null;
  
  const { warnings, stats, overlappingLeave } = conflictResult;
  
  return (
    <Alert variant="warning" className={`border-amber-300 bg-amber-50 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Staffing Warning</AlertTitle>
      <AlertDescription className="text-amber-700">
        <div className="space-y-2 mt-2">
          {warnings.map((warning, idx) => (
            <p key={idx} className="text-sm">{warning.message}</p>
          ))}
          
          {stats && (
            <div className="mt-3 p-2 bg-amber-100 rounded text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>Total in {stats.scopeLabel}: {stats.totalHeadcount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Already on leave during this period: {stats.concurrentLeaveCount - 1}</span>
              </div>
              <div>
                <span>Active after approval: {stats.activeAfterApproval}</span>
              </div>
            </div>
          )}
          
          {overlappingEmployees.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-1">Others on leave during this period:</p>
              <ul className="text-xs space-y-1">
                {overlappingEmployees.slice(0, 5).map((ol, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{ol.employee_name}</span>
                    <span className="text-amber-600">
                      {format(parseISO(ol.start_date), 'dd MMM')} - {format(parseISO(ol.end_date), 'dd MMM')}
                    </span>
                  </li>
                ))}
                {overlappingEmployees.length > 5 && (
                  <li className="text-amber-600">+{overlappingEmployees.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          
          <p className="text-xs mt-2 italic">
            You can still approve this request if needed.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}