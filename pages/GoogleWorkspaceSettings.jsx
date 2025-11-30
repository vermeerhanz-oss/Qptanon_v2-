import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { getConnection, createConnection, disconnect, testConnection } from '@/components/utils/googleWorkspace';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  Mail,
  Globe,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function GoogleWorkspaceSettings() {
  const [context, setContext] = useState(null);
  const [connection, setConnection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const [formData, setFormData] = useState({
    domain: '',
    adminEmail: '',
    externalConnectionId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ctx, conn] = await Promise.all([
        getCurrentUserEmployeeContext(),
        getConnection(),
      ]);
      setContext(ctx);
      setConnection(conn);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const { isAllowed } = useRequirePermission(context, 'canManageCompanySettings', {
    requireAdminMode: true,
    redirectTo: 'Settings',
    message: "You don't have access to integration settings.",
  });

  const handleConnect = async () => {
    if (!formData.domain || !formData.adminEmail) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsConnecting(true);
    try {
      const newConnection = await createConnection({
        domain: formData.domain,
        adminEmail: formData.adminEmail,
        externalConnectionId: formData.externalConnectionId || null,
      });
      setConnection(newConnection);
      setShowConnectModal(false);
      setFormData({ domain: '', adminEmail: '', externalConnectionId: '' });
      toast.success('Google Workspace connected successfully');
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Failed to connect Google Workspace');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    setIsDisconnecting(true);
    try {
      await disconnect(connection.id);
      setConnection({ ...connection, status: 'not_connected', external_connection_id: null });
      setShowDisconnectDialog(false);
      toast.success('Google Workspace disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!connection) return;

    setIsTesting(true);
    try {
      const result = await testConnection(connection.id);
      if (result.success) {
        setConnection({ 
          ...connection, 
          status: 'connected', 
          last_sync_at: new Date().toISOString(),
          last_error: null 
        });
        toast.success('Connection test successful');
      } else {
        setConnection({ 
          ...connection, 
          status: 'error', 
          last_error: result.error 
        });
        toast.error('Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Not Connected
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  const isConnected = connection?.status === 'connected';
  const hasConnection = connection && connection.status !== 'not_connected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Settings')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Google Workspace</h1>
          <p className="text-gray-500 mt-1">
            Connect your HRIS to Google Workspace to provision and suspend accounts automatically.
          </p>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <img 
                  src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" 
                  alt="Google" 
                  className="h-6 w-6"
                />
                Connection Status
              </CardTitle>
              <CardDescription>
                Manage your Google Workspace integration
              </CardDescription>
            </div>
            {getStatusBadge(connection?.status || 'not_connected')}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {connection && connection.status !== 'not_connected' ? (
            <>
              {/* Connection Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Domain</p>
                    <p className="font-medium text-gray-900">{connection.domain || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Admin Email</p>
                    <p className="font-medium text-gray-900">{connection.admin_email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Sync</p>
                    <p className="font-medium text-gray-900">
                      {connection.last_sync_at 
                        ? format(new Date(connection.last_sync_at), 'dd MMM yyyy, HH:mm')
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
                {connection.connection_label && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Label</p>
                      <p className="font-medium text-gray-900">{connection.connection_label}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {connection.last_error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Connection Error</p>
                      <p className="text-sm text-red-700 mt-1">{connection.last_error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowDisconnectDialog(true)}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            /* Not Connected State */
            <div className="text-center py-8">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <img 
                  src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" 
                  alt="Google" 
                  className="h-8 w-8 opacity-50"
                />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Not Connected
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Connect your Google Workspace to automatically provision user accounts when employees are onboarded and suspend them during offboarding.
              </p>
              <Button onClick={() => setShowConnectModal(true)}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect Google Workspace
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What you can do with this integration</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Automatically create Google Workspace accounts when employees are onboarded</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Suspend or delete accounts when employees are offboarded</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Keep employee details in sync between HRIS and Google Workspace</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>View Google account status directly in employee profiles</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Connect Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Google Workspace</DialogTitle>
            <DialogDescription>
              Enter your Google Workspace details to connect the integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Input
                id="domain"
                placeholder="acme.com"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@acme.com"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="externalConnectionId">External Connection ID</Label>
              <Input
                id="externalConnectionId"
                placeholder="Optional - from OAuth backend"
                value={formData.externalConnectionId}
                onChange={(e) => setFormData({ ...formData, externalConnectionId: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                This will be provided by the OAuth backend once configured.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop automatic provisioning and syncing of employee accounts with Google Workspace. 
              Existing Google accounts will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}