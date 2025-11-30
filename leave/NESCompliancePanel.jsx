import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * NES Compliance Panel - displays compliance check results
 */
export default function NESCompliancePanel({ issues, isLoading }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  if (isLoading) {
    return null;
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');
  const isCompliant = errors.length === 0;

  // If all clear
  if (issues.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">All leave policies meet NES minimum standards</p>
              <p className="text-sm text-green-700 mt-0.5">Your policies are configured correctly for Australian National Employment Standards.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
      default:
        return null;
    }
  };

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-100';
      case 'warning':
        return 'bg-amber-50 border-amber-100';
      case 'info':
        return 'bg-blue-50 border-blue-100';
      default:
        return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="space-y-3">
      {/* Main compliance status */}
      <Card className={isCompliant ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCompliant ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`font-medium ${isCompliant ? 'text-amber-800' : 'text-red-800'}`}>
                      {isCompliant 
                        ? `${warnings.length} warning${warnings.length !== 1 ? 's' : ''} found in leave policies`
                        : `${errors.length} compliance issue${errors.length !== 1 ? 's' : ''} found`
                      }
                    </p>
                    <p className={`text-sm mt-0.5 ${isCompliant ? 'text-amber-700' : 'text-red-700'}`}>
                      {errors.length > 0 && `${errors.length} error${errors.length !== 1 ? 's' : ''}`}
                      {errors.length > 0 && warnings.length > 0 && ', '}
                      {warnings.length > 0 && `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
                      {(errors.length > 0 || warnings.length > 0) && infos.length > 0 && ', '}
                      {infos.length > 0 && `${infos.length} info`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              {issues.map((issue, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${getSeverityBg(issue.severity)}`}
                >
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{issue.policyName}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Help section */}
      <Collapsible open={showHelp} onOpenChange={setShowHelp}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
            <HelpCircle className="h-4 w-4 mr-1.5" />
            About NES compliance
            {showHelp ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="border-slate-200 bg-slate-50 mt-2">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700 space-y-2">
                  <p className="font-medium text-slate-900">National Employment Standards (NES) Minimums</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>Annual Leave:</strong> 4 weeks (20 days) per year for full-time employees</li>
                    <li><strong>Personal/Carer's Leave:</strong> 10 days per year for full-time employees</li>
                    <li><strong>Part-time:</strong> Pro-rata entitlements based on hours worked</li>
                    <li><strong>Casual:</strong> Not entitled to paid annual or personal leave (receive 25% loading instead)</li>
                    <li><strong>Shiftworkers:</strong> May be entitled to 5 weeks annual leave under certain awards</li>
                  </ul>
                  <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-200">
                    This is a basic compliance checker, not legal advice. Please consult Fair Work Australia or your HR/legal advisors for definitive guidance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}