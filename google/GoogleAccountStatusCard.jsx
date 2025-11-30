import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, AlertTriangle, XCircle, Link2Off, Clock, ExternalLink, Mail
} from 'lucide-react';

const STATUS_CONFIG = {
  not_linked: { 
    label: 'Not Linked', 
    className: 'bg-gray-100 text-gray-600',
    icon: Link2Off,
  },
  provisioned: { 
    label: 'Provisioned', 
    className: 'bg-green-100 text-green-700',
    icon: CheckCircle2,
  },
  suspended: { 
    label: 'Suspended', 
    className: 'bg-yellow-100 text-yellow-700',
    icon: XCircle,
  },
  error: { 
    label: 'Error', 
    className: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
  },
  pending: { 
    label: 'Pending', 
    className: 'bg-blue-100 text-blue-700',
    icon: Clock,
  },
};

/**
 * Compact card showing Google Workspace account status
 * Used in onboarding/offboarding detail views
 */
export default function GoogleAccountStatusCard({ 
  employee, 
  variant = 'onboarding', // 'onboarding' | 'offboarding'
  hasGoogleTask = false,
  taskStatus = 'not_started' // 'not_started' | 'in_progress' | 'completed'
}) {
  if (!hasGoogleTask && !employee?.google_user_id) {
    return null; // Don't show if no Google task and not linked
  }

  // Determine display status
  let displayStatus = employee?.google_sync_status || 'not_linked';
  
  // For onboarding: show pending if task exists but not completed
  if (variant === 'onboarding' && hasGoogleTask && taskStatus !== 'completed' && displayStatus === 'not_linked') {
    displayStatus = 'pending';
  }
  
  // For offboarding: if task completed, should be suspended
  if (variant === 'offboarding' && hasGoogleTask && taskStatus === 'completed' && displayStatus === 'provisioned') {
    displayStatus = 'suspended';
  }

  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.not_linked;
  const StatusIcon = config.icon;

  const title = variant === 'onboarding' ? 'Google Account' : 'Google Account';
  const description = variant === 'onboarding' 
    ? (displayStatus === 'provisioned' ? 'Account created' : displayStatus === 'pending' ? 'Will be created' : displayStatus === 'error' ? 'Creation failed' : 'No account')
    : (displayStatus === 'suspended' ? 'Account suspended' : displayStatus === 'provisioned' ? 'Still active' : displayStatus === 'error' ? 'Suspension failed' : 'No account');

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              displayStatus === 'provisioned' ? 'bg-green-50' :
              displayStatus === 'suspended' ? 'bg-yellow-50' :
              displayStatus === 'error' ? 'bg-red-50' :
              displayStatus === 'pending' ? 'bg-blue-50' :
              'bg-gray-50'
            }`}>
              <Mail className={`h-5 w-5 ${
                displayStatus === 'provisioned' ? 'text-green-600' :
                displayStatus === 'suspended' ? 'text-yellow-600' :
                displayStatus === 'error' ? 'text-red-600' :
                displayStatus === 'pending' ? 'text-blue-600' :
                'text-gray-400'
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{title}</p>
              <p className="text-xs text-gray-500">{description}</p>
              {employee?.google_primary_email && displayStatus !== 'not_linked' && (
                <p className="text-xs text-gray-400 mt-0.5">{employee.google_primary_email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={config.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {employee?.id && (
              <Link 
                to={createPageUrl('EmployeeProfile') + `?id=${employee.id}&tab=google`}
                className="text-gray-400 hover:text-gray-600"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        
        {displayStatus === 'error' && employee?.google_last_error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            {employee.google_last_error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}