import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Plus, Pencil, Trash2, Loader2, AlertTriangle, FileText, CheckCircle
} from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

const EmploymentAgreement = base44.entities.EmploymentAgreement;
const LeavePolicy = base44.entities.LeavePolicy;

export default function EmploymentAgreements() {
  const [context, setContext] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    country: 'AU',
    description: '',
    default_annual_leave_policy_id: '',
    default_personal_leave_policy_id: '',
    default_long_service_leave_policy_id: '',
    is_active: true,
  });

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManageCompanySettings');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);
      
      if (!ctx.permissions?.canManageCompanySettings) {
        setDataLoading(false);
        return;
      }

      const [allAgreements, allPolicies] = await Promise.all([
        EmploymentAgreement.list(),
        LeavePolicy.filter({ is_active: true }),
      ]);
      setAgreements(allAgreements);
      setPolicies(allPolicies);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleOpenDialog = (agreement = null) => {
    if (agreement) {
      setEditingAgreement(agreement);
      setFormData({
        name: agreement.name || '',
        country: agreement.country || 'AU',
        description: agreement.description || '',
        default_annual_leave_policy_id: agreement.default_annual_leave_policy_id || '',
        default_personal_leave_policy_id: agreement.default_personal_leave_policy_id || '',
        default_long_service_leave_policy_id: agreement.default_long_service_leave_policy_id || '',
        is_active: agreement.is_active !== false,
      });
    } else {
      setEditingAgreement(null);
      setFormData({
        name: '',
        country: 'AU',
        description: '',
        default_annual_leave_policy_id: '',
        default_personal_leave_policy_id: '',
        default_long_service_leave_policy_id: '',
        is_active: true,
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        default_annual_leave_policy_id: formData.default_annual_leave_policy_id || null,
        default_personal_leave_policy_id: formData.default_personal_leave_policy_id || null,
        default_long_service_leave_policy_id: formData.default_long_service_leave_policy_id || null,
      };

      if (editingAgreement) {
        await EmploymentAgreement.update(editingAgreement.id, payload);
      } else {
        await EmploymentAgreement.create(payload);
      }

      setShowDialog(false);
      await loadData();
    } catch (error) {
      console.error('Error saving agreement:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (agreementId) => {
    try {
      await EmploymentAgreement.delete(agreementId);
      setDeleteConfirm(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting agreement:', error);
    }
  };

  const getPolicyName = (policyId) => {
    const policy = policies.find(p => p.id === policyId);
    return policy?.name || '—';
  };

  const getPoliciesByType = (leaveType) => {
    return policies.filter(p => p.leave_type === leaveType);
  };

  if (dataLoading || permLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employment Agreements</h1>
          <p className="text-gray-500 mt-1">Configure awards, enterprise agreements, and their leave policy mappings</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Agreement
        </Button>
      </div>

      {/* Disclaimer */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Configurable Settings – Not Legal Advice</p>
              <p className="mt-1">
                This system provides configurable leave and entitlement settings. It does not provide legal advice, 
                award interpretation, or compliance verification. You are responsible for configuring these agreements 
                to comply with your jurisdiction, awards, enterprise agreements, and applicable legislation. 
                Please consult your HR/legal advisors.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            Agreements ({agreements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agreements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No employment agreements configured</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Agreement
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {agreements.map(agreement => (
                <div 
                  key={agreement.id} 
                  className={`p-4 rounded-lg border ${
                    agreement.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{agreement.name}</p>
                        {!agreement.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {agreement.country && (
                          <Badge variant="outline" className="text-xs uppercase">{agreement.country}</Badge>
                        )}
                      </div>
                      {agreement.description && (
                        <p className="text-sm text-gray-500 mt-1">{agreement.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">Annual:</span>
                          <span className={agreement.default_annual_leave_policy_id ? 'text-gray-700' : 'text-gray-400'}>
                            {agreement.default_annual_leave_policy_id ? getPolicyName(agreement.default_annual_leave_policy_id) : 'System default'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">Personal:</span>
                          <span className={agreement.default_personal_leave_policy_id ? 'text-gray-700' : 'text-gray-400'}>
                            {agreement.default_personal_leave_policy_id ? getPolicyName(agreement.default_personal_leave_policy_id) : 'System default'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">LSL:</span>
                          <span className={agreement.default_long_service_leave_policy_id ? 'text-gray-700' : 'text-gray-400'}>
                            {agreement.default_long_service_leave_policy_id ? getPolicyName(agreement.default_long_service_leave_policy_id) : 'System default'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(agreement)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteConfirm(agreement)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAgreement ? 'Edit Agreement' : 'Add Employment Agreement'}</DialogTitle>
            <DialogDescription>
              Configure an award or enterprise agreement and its default leave policies.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agreement Name *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Clerks Award Level 3, Enterprise Agreement 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={formData.country}
                  onChange={e => setFormData(f => ({ ...f, country: e.target.value.toUpperCase() }))}
                  placeholder="AU"
                  maxLength={3}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={v => setFormData(f => ({ ...f, is_active: v }))}
                />
                <Label className="font-normal">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this award/agreement..."
                rows={2}
              />
            </div>

            <hr className="my-4" />

            <p className="text-sm font-medium text-gray-700">Default Leave Policies</p>
            <p className="text-xs text-gray-500 -mt-2">
              Leave blank to use system defaults based on employment type.
            </p>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Annual Leave Policy</Label>
                <Select 
                  value={formData.default_annual_leave_policy_id || 'default'} 
                  onValueChange={v => setFormData(f => ({ ...f, default_annual_leave_policy_id: v === 'default' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use system default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use system default</SelectItem>
                    {getPoliciesByType('annual').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Personal/Sick Leave Policy</Label>
                <Select 
                  value={formData.default_personal_leave_policy_id || 'default'} 
                  onValueChange={v => setFormData(f => ({ ...f, default_personal_leave_policy_id: v === 'default' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use system default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use system default</SelectItem>
                    {getPoliciesByType('personal').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Long Service Leave Policy</Label>
                <Select 
                  value={formData.default_long_service_leave_policy_id || 'default'} 
                  onValueChange={v => setFormData(f => ({ ...f, default_long_service_leave_policy_id: v === 'default' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use system default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use system default</SelectItem>
                    {getPoliciesByType('long_service').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingAgreement ? 'Save Changes' : 'Create Agreement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agreement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? 
              Employees assigned to this agreement will fall back to system defaults.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm?.id)}>
              Delete Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}