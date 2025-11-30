import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Calendar, Clock, RefreshCw, CheckCircle, Eye, EyeOff
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { canActAsAdmin } from '@/components/utils/permissions';
import { recalculateAllBalancesForEntity } from '@/components/utils/leaveAccrual';
import { ensureDefaultAustralianLeavePolicies } from '@/components/utils/leavePolicyDefaults';
import { checkNESCompliance, checkSinglePolicyCompliance, getHighestSeverityForPolicy } from '@/components/utils/leavePolicyCompliance';
import NESCompliancePanel from '@/components/leave/NESCompliancePanel';

const LeavePolicy = base44.entities.LeavePolicy;
const UserPreferences = base44.entities.UserPreferences;
const CompanyEntity = base44.entities.CompanyEntity;

const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave',
  personal: 'Personal/Carer\'s Leave',
  sick: 'Sick Leave',
  long_service: 'Long Service Leave',
  parental: 'Parental Leave',
  compassionate: 'Compassionate Leave',
  other: 'Other',
};

const LEAVE_TYPE_COLORS = {
  annual: 'bg-blue-100 text-blue-700',
  personal: 'bg-purple-100 text-purple-700',
  sick: 'bg-red-100 text-red-700',
  long_service: 'bg-amber-100 text-amber-700',
  parental: 'bg-pink-100 text-pink-700',
  compassionate: 'bg-gray-100 text-gray-700',
  other: 'bg-slate-100 text-slate-700',
};

const EMPLOYMENT_TYPE_LABELS = {
  any: 'All Types',
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  casual: 'Casual',
  contractor: 'Contractor',
};

export default function LeavePolicies() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ processed: 0, total: 0 });
  const [recalcComplete, setRecalcComplete] = useState(false);
  const [hideSystemPolicies, setHideSystemPolicies] = useState(false);
  const [showComplianceWarning, setShowComplianceWarning] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    country: 'AU',
    leave_type: 'annual',
    employment_type_scope: 'any',
    accrual_unit: 'days_per_year',
    accrual_rate: 20,
    standard_hours_per_day: 7.6,
    hours_per_week_reference: 38,
    max_carryover_hours: null,
    min_service_years_before_accrual: null,
    accrual_rate_after_threshold: null,
    service_includes_prior_entities: true,
    is_default: false,
    is_active: true,
    notes: '',
  });

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    try {
      // Ensure NES default policies exist first
      await ensureDefaultAustralianLeavePolicies();
    } catch (err) {
      console.warn('Could not ensure default policies:', err);
    }
    await loadData();
  };

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const prefs = await UserPreferences.filter({ user_id: currentUser.id });
      setPreferences(prefs[0] || { acting_mode: 'admin' });

      const [allPolicies, allEntities] = await Promise.all([
        LeavePolicy.list(),
        CompanyEntity.list(),
      ]);
      setPolicies(allPolicies);
      setEntities(allEntities);
      if (allEntities.length > 0) {
        setSelectedEntityId(allEntities[0].id);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (policy = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        name: policy.name || '',
        country: policy.country || 'AU',
        leave_type: policy.leave_type || 'annual',
        employment_type_scope: policy.employment_type_scope || 'any',
        accrual_unit: policy.accrual_unit || 'days_per_year',
        accrual_rate: policy.accrual_rate || 0,
        standard_hours_per_day: policy.standard_hours_per_day || 7.6,
        hours_per_week_reference: policy.hours_per_week_reference || 38,
        max_carryover_hours: policy.max_carryover_hours || null,
        min_service_years_before_accrual: policy.min_service_years_before_accrual || null,
        accrual_rate_after_threshold: policy.accrual_rate_after_threshold || null,
        service_includes_prior_entities: policy.service_includes_prior_entities !== false,
        is_default: policy.is_default || false,
        is_active: policy.is_active !== false,
        notes: policy.notes || '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        name: '',
        country: 'AU',
        leave_type: 'annual',
        employment_type_scope: 'any',
        accrual_unit: 'days_per_year',
        accrual_rate: 20,
        standard_hours_per_day: 7.6,
        hours_per_week_reference: 38,
        max_carryover_hours: null,
        min_service_years_before_accrual: null,
        accrual_rate_after_threshold: null,
        service_includes_prior_entities: true,
        is_default: false,
        is_active: true,
        notes: '',
      });
    }
    setShowDialog(true);
  };

  const handleSave = async (forceOverride = false) => {
    const payload = {
      ...formData,
      accrual_rate: parseFloat(formData.accrual_rate) || 0,
      standard_hours_per_day: parseFloat(formData.standard_hours_per_day) || 7.6,
      hours_per_week_reference: parseFloat(formData.hours_per_week_reference) || 38,
      max_carryover_hours: formData.max_carryover_hours ? parseFloat(formData.max_carryover_hours) : null,
      min_service_years_before_accrual: formData.min_service_years_before_accrual ? parseFloat(formData.min_service_years_before_accrual) : null,
      accrual_rate_after_threshold: formData.accrual_rate_after_threshold ? parseFloat(formData.accrual_rate_after_threshold) : null,
    };

    // Check compliance before saving (unless force override)
    if (!forceOverride) {
      const policyToCheck = { ...payload, id: editingPolicy?.id || 'new' };
      const issues = checkSinglePolicyCompliance(policyToCheck);
      const hasErrors = issues.some(i => i.severity === 'error');
      
      if (hasErrors) {
        setPendingSaveData(payload);
        setShowComplianceWarning(true);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingPolicy) {
        await LeavePolicy.update(editingPolicy.id, payload);
      } else {
        await LeavePolicy.create(payload);
      }

      setShowDialog(false);
      setShowComplianceWarning(false);
      setPendingSaveData(null);
      await loadData();
    } catch (error) {
      console.error('Error saving policy:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (policyId) => {
    try {
      await LeavePolicy.delete(policyId);
      setDeleteConfirm(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting policy:', error);
    }
  };

  // Check if a policy is a system policy (should not be deleted)
  const isSystemPolicy = (policy) => policy?.is_system === true;

  const isAdminMode = canActAsAdmin(user, preferences);

  const handleBatchRecalculate = async () => {
    setIsRecalculating(true);
    setRecalcComplete(false);
    setRecalcProgress({ processed: 0, total: 0 });

    try {
      await recalculateAllBalancesForEntity(
        selectedEntityId || null,
        (progress) => setRecalcProgress(progress)
      );
      setRecalcComplete(true);
    } catch (error) {
      console.error('Error recalculating:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAdminMode) {
    return (
      <div className="p-6">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <p className="text-yellow-700">You don't have permission to manage leave policies.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Run NES compliance checks
  const complianceIssues = useMemo(() => {
    return checkNESCompliance(policies);
  }, [policies]);

  // Separate system and company policies
  const systemPolicies = policies.filter(p => p.is_system && p.country === 'AU');
  const companyPolicies = policies.filter(p => !p.is_system);

  // Group company policies by leave type
  const groupedPolicies = companyPolicies.reduce((acc, policy) => {
    if (!acc[policy.leave_type]) acc[policy.leave_type] = [];
    acc[policy.leave_type].push(policy);
    return acc;
  }, {});

  // Get severity indicator for a policy
  const getPolicySeverity = (policyId) => getHighestSeverityForPolicy(policyId, complianceIssues);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Policies</h1>
          <p className="text-gray-500 mt-1">Configure leave accrual rates and entitlements</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Batch Recalculation */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-gray-400" />
                Recalculate Leave Balances
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Recalculate all leave balances for employees in an entity. Use this after policy changes or corrections.
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex items-end gap-4">
            {entities.length > 1 && (
              <div className="flex-1 max-w-xs">
                <Label className="text-sm text-gray-500">Entity</Label>
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Entities</SelectItem>
                    {entities.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.abbreviation || e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button 
              onClick={handleBatchRecalculate}
              disabled={isRecalculating}
              variant="outline"
            >
              {isRecalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRecalculating ? 'Recalculating...' : 'Recalculate All'}
            </Button>
          </div>

          {isRecalculating && recalcProgress.total > 0 && (
            <div className="mt-4">
              <Progress value={(recalcProgress.processed / recalcProgress.total) * 100} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">
                Processing {recalcProgress.processed} of {recalcProgress.total} employees...
              </p>
            </div>
          )}

          {recalcComplete && (
            <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Successfully recalculated {recalcProgress.processed} employee balances.
            </div>
          )}
        </CardContent>
      </Card>

      {/* NES Compliance Panel */}
      <NESCompliancePanel issues={complianceIssues} isLoading={isLoading} />

      {/* Disclaimer */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Configurable Settings – Not Legal Advice</p>
              <p className="mt-1">
                This system provides configurable leave and entitlement settings. It does not provide legal advice, 
                award interpretation, or compliance verification. You are responsible for configuring these policies 
                to comply with your jurisdiction, awards, enterprise agreements, and applicable legislation 
                (e.g. National Employment Standards). Please consult your HR/legal advisors.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System NES Policies */}
      {systemPolicies.length > 0 && !hideSystemPolicies && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className="bg-indigo-100 text-indigo-700">System</Badge>
                  NES Default Policies (Australia)
                </CardTitle>
                <CardDescription className="mt-1">
                  These are the National Employment Standards minimum entitlements. They are used as defaults when no custom policy is assigned.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemPolicies.map(policy => (
                <div 
                  key={policy.id} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-indigo-50/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{policy.name}</p>
                      <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200">NES</Badge>
                      {policy.is_default && (
                        <Badge variant="outline" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {policy.accrual_rate} {policy.accrual_unit === 'days_per_year' ? 'days' : policy.accrual_unit === 'weeks_per_year' ? 'weeks' : 'hours'}/year
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {EMPLOYMENT_TYPE_LABELS[policy.employment_type_scope] || 'All Types'}
                      </Badge>
                      <Badge className={LEAVE_TYPE_COLORS[policy.leave_type]}>
                        {LEAVE_TYPE_LABELS[policy.leave_type]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(policy)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Policies Header */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Company Leave Policies</h2>
          <p className="text-sm text-gray-500">Custom policies for Awards, EBAs, or company-specific arrangements</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox 
            id="hide-system" 
            checked={hideSystemPolicies} 
            onCheckedChange={setHideSystemPolicies}
          />
          <Label htmlFor="hide-system" className="text-sm text-gray-600 cursor-pointer flex items-center gap-1.5">
            {hideSystemPolicies ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Hide system NES policies
          </Label>
        </div>
      </div>

      {/* Company Policies by type */}
      {Object.keys(LEAVE_TYPE_LABELS).map(leaveType => {
        const typePolicies = groupedPolicies[leaveType] || [];
        if (typePolicies.length === 0 && !['annual', 'personal'].includes(leaveType)) return null;

        return (
          <Card key={leaveType}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Badge className={LEAVE_TYPE_COLORS[leaveType]}>
                  {LEAVE_TYPE_LABELS[leaveType]}
                </Badge>
                <span className="text-sm text-gray-500">
                  {typePolicies.length} {typePolicies.length === 1 ? 'policy' : 'policies'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {typePolicies.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p>No policies configured for {LEAVE_TYPE_LABELS[leaveType]}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                    setFormData(f => ({ ...f, leave_type: leaveType }));
                    handleOpenDialog();
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Policy
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {typePolicies.map(policy => {
                    const severity = getPolicySeverity(policy.id);
                    const borderClass = severity === 'error' 
                      ? 'border-l-4 border-l-red-500' 
                      : severity === 'warning'
                      ? 'border-l-4 border-l-amber-400'
                      : severity === 'info'
                      ? 'border-l-4 border-l-blue-400'
                      : '';
                    
                    return (
                      <div 
                        key={policy.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border ${borderClass} ${
                          policy.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {severity === 'error' && (
                              <AlertTriangle className="h-4 w-4 text-red-500" title="NES compliance issue" />
                            )}
                            {severity === 'warning' && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" title="Configuration warning" />
                            )}
                            <p className="font-medium text-gray-900">{policy.name}</p>
                            {policy.is_default && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                            {!policy.is_active && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {policy.accrual_rate} {policy.accrual_unit === 'days_per_year' ? 'days' : policy.accrual_unit === 'weeks_per_year' ? 'weeks' : 'hours'}/year
                            </span>
                            <span>
                              {policy.standard_hours_per_day}h/day
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {EMPLOYMENT_TYPE_LABELS[policy.employment_type_scope] || 'All Types'}
                            </Badge>
                            {policy.min_service_years_before_accrual && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                After {policy.min_service_years_before_accrual} yrs
                              </Badge>
                            )}
                            {policy.country && (
                              <span className="uppercase">{policy.country}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(policy)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!isSystemPolicy(policy) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-700"
                              onClick={() => setDeleteConfirm(policy)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Add Leave Policy'}</DialogTitle>
            <DialogDescription>
              Configure accrual rates and entitlements for this leave type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Policy Name *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. AU Default Full-Time"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <Select 
                  value={formData.leave_type} 
                  onValueChange={v => setFormData(f => ({ ...f, leave_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select 
                  value={formData.employment_type_scope} 
                  onValueChange={v => setFormData(f => ({ ...f, employment_type_scope: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={formData.country}
                onChange={e => setFormData(f => ({ ...f, country: e.target.value.toUpperCase() }))}
                placeholder="AU"
                maxLength={3}
                className="w-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Accrual Rate *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.accrual_rate}
                  onChange={e => setFormData(f => ({ ...f, accrual_rate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Accrual Unit</Label>
                <Select 
                  value={formData.accrual_unit} 
                  onValueChange={v => setFormData(f => ({ ...f, accrual_unit: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days_per_year">Days per year</SelectItem>
                    <SelectItem value="weeks_per_year">Weeks per year</SelectItem>
                    <SelectItem value="hours_per_year">Hours per year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hours/Day</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.standard_hours_per_day}
                  onChange={e => setFormData(f => ({ ...f, standard_hours_per_day: e.target.value }))}
                />
                <p className="text-xs text-gray-500">For day↔hour conversion</p>
              </div>
              <div className="space-y-2">
                <Label>Hours/Week Ref</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.hours_per_week_reference}
                  onChange={e => setFormData(f => ({ ...f, hours_per_week_reference: e.target.value }))}
                />
                <p className="text-xs text-gray-500">For pro-rata calc</p>
              </div>
              <div className="space-y-2">
                <Label>Max Carryover (hrs)</Label>
                <Input
                  type="number"
                  value={formData.max_carryover_hours || ''}
                  onChange={e => setFormData(f => ({ ...f, max_carryover_hours: e.target.value || null }))}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            {/* Long Service Leave specific fields */}
            {formData.leave_type === 'long_service' && (
              <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Long Service Leave thresholds vary by jurisdiction. Configure these to match your applicable laws, awards, or enterprise agreements.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Service Years</Label>
                    <Input
                      type="number"
                      step="1"
                      value={formData.min_service_years_before_accrual || ''}
                      onChange={e => setFormData(f => ({ ...f, min_service_years_before_accrual: e.target.value || null }))}
                      placeholder="e.g. 7 or 10"
                    />
                    <p className="text-xs text-gray-500">Years before LSL starts accruing</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Accrual After Threshold</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.accrual_rate_after_threshold || ''}
                      onChange={e => setFormData(f => ({ ...f, accrual_rate_after_threshold: e.target.value || null }))}
                      placeholder="e.g. 0.867"
                    />
                    <p className="text-xs text-gray-500">Rate per year after threshold (in {formData.accrual_unit.replace('_per_year', '')})</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.service_includes_prior_entities}
                    onCheckedChange={v => setFormData(f => ({ ...f, service_includes_prior_entities: v }))}
                  />
                  <Label className="font-normal text-sm">Count service from prior entities</Label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="Internal notes about this policy..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={v => setFormData(f => ({ ...f, is_default: v }))}
                />
                <Label className="font-normal">Default policy for this leave type</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={v => setFormData(f => ({ ...f, is_active: v }))}
                />
                <Label className="font-normal">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.accrual_rate}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingPolicy ? 'Save Changes' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm?.id)}>
              Delete Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compliance Warning Dialog */}
      <Dialog open={showComplianceWarning} onOpenChange={setShowComplianceWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              NES Compliance Warning
            </DialogTitle>
            <DialogDescription>
              This policy does not meet minimum National Employment Standards requirements. Are you sure you want to save it?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3">
                <p className="text-sm text-amber-800">
                  Saving this policy may result in non-compliant leave entitlements. Please review the configuration or consult your HR/legal advisors.
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowComplianceWarning(false);
              setPendingSaveData(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}