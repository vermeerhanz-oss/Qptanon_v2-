import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, FileText, Loader2, Settings, Check, X, Users, ArrowLeft
} from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

const Policy = base44.entities.Policy;
const PolicyVersion = base44.entities.PolicyVersion;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;
const CompanyEntity = base44.entities.CompanyEntity;
const Employee = base44.entities.Employee;

const CATEGORIES = ['HR', 'IT', 'Workplace Health & Safety', 'Finance', 'Legal', 'Operations', 'Other'];

export default function PolicyLibrary() {
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [policies, setPolicies] = useState([]);
  const [versions, setVersions] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [entities, setEntities] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: '',
    code: '',
    category: '',
    entity_id: '',
    country: '',
    is_mandatory: false,
    is_active: true,
  });

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManagePolicies', {
    requireAdminMode: true,
    message: "You need admin access to manage policies."
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);

      if (!ctx.permissions?.canManagePolicies) {
        setIsLoading(false);
        return;
      }

      const [pols, vers, acks, ents, emps] = await Promise.all([
        Policy.list(),
        PolicyVersion.list(),
        PolicyAcknowledgement.list(),
        CompanyEntity.list(),
        Employee.filter({ status: 'active' }),
      ]);

      setPolicies(pols);
      setVersions(vers);
      setAcknowledgements(acks);
      setEntities(ents);
      setEmployees(emps);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build policy data with version and acknowledgement info
  const policyData = useMemo(() => {
    return policies.map(policy => {
      // Get all versions for this policy
      const policyVersions = versions.filter(v => v.policy_id === policy.id);
      
      // Get the latest published version
      const publishedVersions = policyVersions.filter(v => v.is_published);
      const latestPublished = publishedVersions.sort((a, b) => b.version_number - a.version_number)[0];
      
      // Get latest version number overall
      const latestVersionNumber = policyVersions.length > 0 
        ? Math.max(...policyVersions.map(v => v.version_number))
        : 0;

      // Calculate employees in scope
      let employeesInScope = employees;
      if (policy.entity_id) {
        employeesInScope = employees.filter(e => e.entity_id === policy.entity_id);
      }
      const totalInScope = employeesInScope.length;

      // Count acknowledgements for latest published version
      let acknowledgedCount = 0;
      if (latestPublished) {
        const versionAcks = acknowledgements.filter(a => a.version_id === latestPublished.id);
        acknowledgedCount = versionAcks.length;
      }

      // Get entity name
      const entity = entities.find(e => e.id === policy.entity_id);

      return {
        ...policy,
        latestVersionNumber,
        latestPublished,
        effectiveFrom: latestPublished?.effective_from,
        acknowledgedCount,
        totalInScope,
        entityName: entity?.name || 'All entities',
      };
    });
  }, [policies, versions, acknowledgements, entities, employees]);

  const handleCreatePolicy = async () => {
    if (!newPolicy.name.trim()) return;
    
    setSaving(true);
    try {
      const created = await Policy.create({
        ...newPolicy,
        entity_id: newPolicy.entity_id || null,
      });
      setShowNewModal(false);
      setNewPolicy({
        name: '',
        code: '',
        category: '',
        entity_id: '',
        country: '',
        is_mandatory: false,
        is_active: true,
      });
      navigate(createPageUrl('PolicyDetail') + `?id=${created.id}`);
    } catch (error) {
      console.error('Error creating policy:', error);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to={createPageUrl('CompanySettings')}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Policy Library</h1>
          <p className="text-gray-500 mt-1">Create, update, and track company policies.</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Policy
        </Button>
      </div>

      {/* Policy Table */}
      <Card>
        <CardContent className="p-0">
          {policyData.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No policies yet. Create your first policy to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective From</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acknowledged</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {policyData.map(policy => (
                    <tr key={policy.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{policy.name}</p>
                          {policy.code && (
                            <p className="text-xs text-gray-500">{policy.code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.category || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.entityName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.country || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {policy.is_mandatory ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {policy.is_active ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Archived</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {policy.latestVersionNumber > 0 ? `v${policy.latestVersionNumber}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {policy.effectiveFrom || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {policy.latestPublished ? (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {policy.acknowledgedCount} / {policy.totalInScope}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No published version</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={createPageUrl('PolicyDetail') + `?id=${policy.id}`}>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Manage
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Policy Modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newPolicy.name}
                onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                placeholder="e.g. Code of Conduct"
              />
            </div>
            <div>
              <Label htmlFor="code">Code (optional)</Label>
              <Input
                id="code"
                value={newPolicy.code}
                onChange={(e) => setNewPolicy({ ...newPolicy, code: e.target.value })}
                placeholder="e.g. CODE_OF_CONDUCT"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={newPolicy.category}
                onValueChange={(value) => setNewPolicy({ ...newPolicy, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entity">Entity / Scope</Label>
              <Select
                value={newPolicy.entity_id}
                onValueChange={(value) => setNewPolicy({ ...newPolicy, entity_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All entities</SelectItem>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={newPolicy.country}
                onChange={(e) => setNewPolicy({ ...newPolicy, country: e.target.value })}
                placeholder="e.g. AU"
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mandatory"
                  checked={newPolicy.is_mandatory}
                  onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, is_mandatory: checked })}
                />
                <Label htmlFor="mandatory" className="font-normal">Mandatory</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="active"
                  checked={newPolicy.is_active}
                  onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, is_active: checked })}
                />
                <Label htmlFor="active" className="font-normal">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreatePolicy} disabled={saving || !newPolicy.name.trim()}>
              {saving ? 'Creating...' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}