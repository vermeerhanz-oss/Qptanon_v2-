import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Mail, RefreshCw, Loader2, CheckCircle2, AlertTriangle, 
  XCircle, Clock, Link2Off, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { updateUserProfileForEmployee, provisionUserForEmployee } from '@/components/utils/googleWorkspace';

const Employee = base44.entities.Employee;

const SYNC_STATUS_CONFIG = {
  not_linked: { 
    label: 'Not Linked', 
    className: 'bg-gray-100 text-gray-600',
    icon: Link2Off,
    description: 'No Google Workspace account linked'
  },
  provisioned: { 
    label: 'Active', 
    className: 'bg-green-100 text-green-700',
    icon: CheckCircle2,
    description: 'Google Workspace account is active and synced'
  },
  suspended: { 
    label: 'Suspended', 
    className: 'bg-yellow-100 text-yellow-700',
    icon: XCircle,
    description: 'Google Workspace account is suspended'
  },
  error: { 
    label: 'Error', 
    className: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
    description: 'Last sync encountered an error'
  },
};

export default function ProfileGoogleSection({ employee, canEdit, onUpdate }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const status = employee.google_sync_status || 'not_linked';
  const statusConfig = SYNC_STATUS_CONFIG[status] || SYNC_STATUS_CONFIG.not_linked;
  const StatusIcon = statusConfig.icon;

  const handleSyncNow = async () => {
    if (!employee.google_user_id) {
      setSyncResult({ ok: false, error: 'No Google account linked' });
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await updateUserProfileForEmployee(employee);
      setSyncResult(result);
      
      if (result.ok) {
        // Refresh employee data
        const updated = await Employee.filter({ id: employee.id });
        if (updated.length > 0 && onUpdate) {
          onUpdate(updated[0]);
        }
      }
    } catch (error) {
      setSyncResult({ ok: false, error: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProvisionNow = async () => {
    setIsProvisioning(true);
    setSyncResult(null);

    try {
      const result = await provisionUserForEmployee(employee);
      setSyncResult(result);
      
      if (result.ok) {
        // Refresh employee data
        const updated = await Employee.filter({ id: employee.id });
        if (updated.length > 0 && onUpdate) {
          onUpdate(updated[0]);
        }
      }
    } catch (error) {
      setSyncResult({ ok: false, error: error.message });
    } finally {
      setIsProvisioning(false);
    }
  };

  const hasGoogleAccount = !!employee.google_user_id;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Google Workspace</h2>
          </div>
          {canEdit && hasGoogleAccount && status !== 'suspended' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSyncNow}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Sync Now
            </Button>
          )}
        </div>

        {/* Sync Result Message */}
        {syncResult && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            syncResult.ok 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {syncResult.ok ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Profile synced to Google Workspace successfully</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{syncResult.error || 'Sync failed'}</span>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status */}
          <div>
            <Label className="text-xs text-gray-500">Status</Label>
            <div className="mt-1 flex items-center gap-2">
              <Badge className={statusConfig.className}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">{statusConfig.description}</p>
          </div>

          {/* Google Email */}
          <div>
            <Label className="text-xs text-gray-500">Google Email</Label>
            <p className="text-gray-900 mt-1">
              {employee.google_primary_email || '—'}
            </p>
          </div>

          {/* Sync Enabled */}
          <div>
            <Label className="text-xs text-gray-500">Auto-Sync</Label>
            <p className="text-gray-900 mt-1">
              {employee.google_sync_enabled !== false ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Enabled
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500">
                  <XCircle className="h-4 w-4" />
                  Disabled
                </span>
              )}
            </p>
          </div>

          {/* Last Sync */}
          <div>
            <Label className="text-xs text-gray-500">Last Synced</Label>
            <p className="text-gray-900 mt-1 flex items-center gap-1">
              {employee.google_last_sync_at ? (
                <>
                  <Clock className="h-4 w-4 text-gray-400" />
                  {format(new Date(employee.google_last_sync_at), 'dd MMM yyyy, HH:mm')}
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {status === 'error' && employee.google_last_error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Last Sync Error</p>
                <p className="text-sm text-red-600 mt-1">{employee.google_last_error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info for non-linked accounts */}
        {!hasGoogleAccount && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                This employee does not have a linked Google Workspace account.
              </p>
              {canEdit && (
                <Button 
                  size="sm" 
                  onClick={handleProvisionNow}
                  disabled={isProvisioning}
                  className="ml-4"
                >
                  {isProvisioning ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-1" />
                  )}
                  Provision Now
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}