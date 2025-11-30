import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { 
  ArrowLeft, Plus, FileText, Loader2, Edit, Check, Upload, Users, Calendar, Trash2, Info, Globe, Building2
} from 'lucide-react';
import ReactQuill from 'react-quill';
import { format, parseISO } from 'date-fns';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import PolicyAcknowledgementReport from '@/components/policies/PolicyAcknowledgementReport';
import { sendNotification } from '@/components/utils/notifications';
import { logForCurrentUser } from '@/components/utils/audit';

const Policy = base44.entities.Policy;
const Department = base44.entities.Department;
const PolicyVersion = base44.entities.PolicyVersion;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;
const CompanyEntity = base44.entities.CompanyEntity;
const Employee = base44.entities.Employee;
const Document = base44.entities.Document;

export default function PolicyDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const policyId = urlParams.get('id');

  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [policy, setPolicy] = useState(null);
  const [versions, setVersions] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [entities, setEntities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [editingVersion, setEditingVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [versionForm, setVersionForm] = useState({
    title: '',
    summary: '',
    document_url: '',
    content: '',
    effective_from: '',
    is_published: false,
  });

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManagePolicies', {
    requireAdminMode: true,
    message: "You need admin access to manage policies."
  });

  useEffect(() => {
    if (policyId) {
      loadData();
    }
  }, [policyId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);

      if (!ctx.permissions?.canManagePolicies) {
        setIsLoading(false);
        return;
      }

      const [pols, vers, acks, ents, emps, depts] = await Promise.all([
        Policy.filter({ id: policyId }),
        PolicyVersion.filter({ policy_id: policyId }),
        PolicyAcknowledgement.filter({ policy_id: policyId }),
        CompanyEntity.list(),
        Employee.filter({ status: 'active' }),
        Department.list(),
      ]);

      if (pols.length === 0) {
        navigate(createPageUrl('PolicyLibrary'));
        return;
      }

      setPolicy(pols[0]);
      setVersions(vers.sort((a, b) => b.version_number - a.version_number));
      setAcknowledgements(acks);
      setEntities(ents);
      setEmployees(emps);
      setDepartments(depts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get latest published version
  const latestPublished = useMemo(() => {
    const published = versions.filter(v => v.is_published);
    return published.sort((a, b) => b.version_number - a.version_number)[0] || null;
  }, [versions]);

  // Calculate acknowledgement stats
  const ackStats = useMemo(() => {
    if (!policy || !latestPublished) {
      return { total: 0, acknowledged: 0, percentage: 0 };
    }

    let employeesInScope = employees;
    if (policy.entity_id) {
      employeesInScope = employees.filter(e => e.entity_id === policy.entity_id);
    }

    const total = employeesInScope.length;
    const versionAcks = acknowledgements.filter(a => a.version_id === latestPublished.id);
    const acknowledged = versionAcks.length;
    const percentage = total > 0 ? Math.round((acknowledged / total) * 100) : 0;

    return { total, acknowledged, percentage };
  }, [policy, latestPublished, employees, acknowledgements]);

  // Entity name
  const entityName = useMemo(() => {
    if (!policy?.entity_id) return 'All entities';
    const entity = entities.find(e => e.id === policy.entity_id);
    return entity?.name || 'Unknown entity';
  }, [policy, entities]);

  const handleOpenVersionModal = (version = null) => {
    if (version) {
      // Only allow editing unpublished drafts (or limited editing for published)
      setEditingVersion(version);
      setVersionForm({
        title: version.title || '',
        summary: version.summary || '',
        document_url: version.document_url || '',
        content: version.content || '',
        effective_from: version.effective_from || '',
        is_published: version.is_published || false,
      });
    } else {
      setEditingVersion(null);
      setVersionForm({
        title: '',
        summary: '',
        document_url: '',
        content: '',
        effective_from: format(new Date(), 'yyyy-MM-dd'),
        is_published: false,
      });
    }
    setShowVersionModal(true);
  };

  const handleSaveVersion = async () => {
    setSaving(true);
    try {
      const nextVersionNumber = versions.length > 0 
        ? Math.max(...versions.map(v => v.version_number)) + 1 
        : 1;

      // Build title with fallback
      const finalTitle = versionForm.title.trim() || `Version ${editingVersion?.version_number || nextVersionNumber}`;

      if (editingVersion) {
        // For published versions, only allow limited edits
        const updateData = editingVersion.is_published
          ? { summary: versionForm.summary, document_url: versionForm.document_url }
          : { ...versionForm, title: finalTitle };
        
        await PolicyVersion.update(editingVersion.id, updateData);

        // Update or create Document record if document_url changed
        if (versionForm.document_url && versionForm.document_url !== editingVersion.document_url) {
          await createPolicyDocument(editingVersion.id, versionForm.document_url);
        }
      } else {
        // Create new version
        const newVersion = await PolicyVersion.create({
          policy_id: policyId,
          version_number: nextVersionNumber,
          ...versionForm,
          title: finalTitle,
          created_by_id: context.employee?.id,
        });

        // Create Document record if file uploaded
        if (versionForm.document_url) {
          await createPolicyDocument(newVersion.id, versionForm.document_url);
        }
      }

      // If publishing, unpublish other versions
      if (versionForm.is_published && !editingVersion?.is_published) {
        for (const v of versions) {
          if (v.is_published) {
            await PolicyVersion.update(v.id, { is_published: false });
          }
        }
      }

      setShowVersionModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving version:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishVersion = async (version) => {
    setSaving(true);
    try {
      // Unpublish all other versions
      for (const v of versions) {
        if (v.is_published && v.id !== version.id) {
          await PolicyVersion.update(v.id, { is_published: false });
        }
      }
      // Publish this version
      await PolicyVersion.update(version.id, { is_published: true });

      // Audit log
      await logForCurrentUser({
        eventType: 'policy_version_published',
        entityType: 'PolicyVersion',
        entityId: version.id,
        description: `Published policy version ${version.version_number} for ${policy.name}`,
      });

      // Notify employees if policy is mandatory
      if (policy.is_mandatory) {
        await notifyEmployeesOfPolicyUpdate(policy, employees, entities);
      }

      await loadData();
    } catch (error) {
      console.error('Error publishing version:', error);
    } finally {
      setSaving(false);
    }
  };

  const notifyEmployeesOfPolicyUpdate = async (pol, allEmployees, allEntities) => {
    // Filter employees in scope
    let employeesInScope = allEmployees.filter(e => e.status === 'active');
    
    if (pol.entity_id) {
      employeesInScope = employeesInScope.filter(e => e.entity_id === pol.entity_id);
    }
    
    if (pol.country) {
      employeesInScope = employeesInScope.filter(e => e.country === pol.country);
    }

    for (const emp of employeesInScope) {
      if (emp.user_id) {
        try {
          await sendNotification({
            userId: emp.user_id,
            type: 'policy_update',
            title: 'Policy updated',
            message: `${pol.name} has a new version that requires your acknowledgement.`,
            link: '/policies/my',
            relatedEmployeeId: emp.id,
          });
        } catch (error) {
          console.error('Error sending policy update notification:', error);
        }
      }
    }
  };

  const createPolicyDocument = async (versionId, fileUrl) => {
    try {
      // Extract filename from URL
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1] || 'policy-document';

      await Document.create({
        file_url: fileUrl,
        file_name: fileName,
        uploaded_by_id: context.employee?.id || context.user?.id,
        category: 'policy',
        related_policy_version_id: versionId,
        visibility: 'employee',
      });
    } catch (error) {
      console.error('Error creating policy document record:', error);
    }
  };

  const handleDeleteVersion = async (version) => {
    if (!confirm('Are you sure you want to delete this version?')) return;
    
    try {
      await PolicyVersion.delete(version.id);
      await loadData();
    } catch (error) {
      console.error('Error deleting version:', error);
    }
  };

  if (isLoading || permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed || !policy) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={createPageUrl('PolicyLibrary')}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Policy Library
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{policy.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              {policy.code && (
                <Badge variant="outline">{policy.code}</Badge>
              )}
              {policy.category && (
                <Badge className="bg-gray-100 text-gray-700">{policy.category}</Badge>
              )}
              <span className="text-sm text-gray-500">{entityName}</span>
              {policy.country && (
                <span className="text-sm text-gray-500">• {policy.country}</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              {policy.is_mandatory && (
                <Badge className="bg-amber-100 text-amber-700">Mandatory</Badge>
              )}
              {policy.is_active ? (
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600">Archived</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Acknowledgement Summary */}
      {latestPublished && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Acknowledgement Status</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {ackStats.acknowledged} <span className="text-lg font-normal text-gray-400">/ {ackStats.total}</span>
                  </p>
                  <p className="text-sm text-gray-500">employees acknowledged v{latestPublished.version_number}</p>
                </div>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">{ackStats.percentage}%</span>
                </div>
                <Progress value={ackStats.percentage} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acknowledgement Report */}
      {latestPublished && (
        <PolicyAcknowledgementReport
          employees={employees}
          acknowledgements={acknowledgements}
          departments={departments}
          entities={entities}
          latestVersion={latestPublished}
          policyEntityId={policy.entity_id}
          policyCountry={policy.country}
          policyDocumentFilename={latestPublished.document_url ? latestPublished.document_url.split('/').pop() : null}
        />
      )}

      {/* Versions Section */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Versions</h3>
              <p className="text-xs text-gray-500 mt-0.5">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
            </div>
            <Button size="sm" onClick={() => handleOpenVersionModal()}>
              <Plus className="h-4 w-4 mr-2" />
              New Version
            </Button>
          </div>
          
          {versions.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No versions yet. Create a version to publish this policy.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {versions.map(version => (
                <div key={version.id} className="px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">
                          v{version.version_number}
                        </span>
                        {version.title && (
                          <span className="text-gray-600">— {version.title}</span>
                        )}
                        {version.is_published && (
                          <Badge className="bg-green-100 text-green-700">Published</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        {version.effective_from && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Effective: {version.effective_from}
                          </div>
                        )}
                        {version.created_date && (
                          <span>Created: {format(parseISO(version.created_date), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                      {version.summary && (
                        <p className="text-sm text-gray-600 mt-2">{version.summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!version.is_published && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePublishVersion(version)}
                          disabled={saving}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Publish
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenVersionModal(version)}
                        title={version.is_published ? "Edit summary only" : "Edit draft"}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!version.is_published && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteVersion(version)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version Drawer */}
      <Sheet open={showVersionModal} onOpenChange={setShowVersionModal}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingVersion ? `Edit Version ${editingVersion.version_number}` : 'Create New Version'}
            </SheetTitle>
          </SheetHeader>
          
          <div className="space-y-5 py-6">
            {/* Read-only scope info */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-slate-500 mt-0.5" />
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-700 mb-1">Policy Scope</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{entityName}</span>
                    </div>
                    {policy?.country && (
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        <span>{policy.country}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    This policy applies to employees matching these profile fields.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={versionForm.title}
                onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })}
                placeholder={`Version ${versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1}`}
                className="mt-1.5"
              />
              <p className="text-xs text-gray-500 mt-1">Optional. Defaults to "Version X" if left blank.</p>
            </div>

            <div>
              <Label htmlFor="summary">Summary / Changelog</Label>
              <Textarea
                id="summary"
                value={versionForm.summary}
                onChange={(e) => setVersionForm({ ...versionForm, summary: e.target.value })}
                placeholder="What changed in this version?"
                rows={2}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="effective_from">Effective From</Label>
              <Input
                id="effective_from"
                type="date"
                value={versionForm.effective_from}
                onChange={(e) => setVersionForm({ ...versionForm, effective_from: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Policy Document (PDF, DOCX)</Label>
              <div className="mt-1.5">
                {versionForm.document_url ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <a 
                      href={versionForm.document_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline truncate flex-1"
                    >
                      View uploaded document
                    </a>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setVersionForm({ ...versionForm, document_url: '' })}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingFile(true);
                        try {
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          setVersionForm({ ...versionForm, document_url: file_url });
                        } catch (error) {
                          console.error('Error uploading file:', error);
                        } finally {
                          setUploadingFile(false);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                      {uploadingFile ? (
                        <Loader2 className="h-6 w-6 mx-auto animate-spin text-indigo-600" />
                      ) : (
                        <>
                          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                          <p className="text-sm text-gray-600">Click to upload PDF or DOCX</p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Optional. Upload a document for employees to download.</p>
            </div>

            <div>
              <Label>Policy Content</Label>
              <div className="mt-1.5 border rounded-md">
                <ReactQuill
                  value={versionForm.content}
                  onChange={(value) => setVersionForm({ ...versionForm, content: value })}
                  placeholder="Full policy text..."
                  className="bg-white"
                  style={{ minHeight: '200px' }}
                />
              </div>
            </div>

            {/* Only show publish checkbox for new versions or unpublished drafts */}
            {(!editingVersion || !editingVersion.is_published) && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="is_published"
                  checked={versionForm.is_published}
                  onCheckedChange={(checked) => setVersionForm({ ...versionForm, is_published: checked })}
                />
                <Label htmlFor="is_published" className="font-normal">Publish immediately</Label>
              </div>
            )}

            {editingVersion?.is_published && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  This version is published. Only summary and document URL can be edited.
                </p>
              </div>
            )}
          </div>

          <SheetFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowVersionModal(false)}>Cancel</Button>
            <Button onClick={handleSaveVersion} disabled={saving}>
              {saving ? 'Saving...' : editingVersion ? 'Update Version' : 'Create Version'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}