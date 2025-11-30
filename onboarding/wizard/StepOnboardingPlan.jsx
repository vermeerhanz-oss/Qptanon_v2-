import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardList, FileText, MessageSquare, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function StepOnboardingPlan({
  data,
  onChange,
  templates = [],
  policies = [],
}) {
  const onboarding = data.onboarding || {};

  const updateOnboarding = (field, value) => {
    onChange({
      ...data,
      onboarding: { ...onboarding, [field]: value },
    });
  };

  const togglePolicy = (policyId) => {
    const currentPolicies = onboarding.policy_ids || [];
    const newPolicies = currentPolicies.includes(policyId)
      ? currentPolicies.filter((id) => id !== policyId)
      : [...currentPolicies, policyId];
    updateOnboarding('policy_ids', newPolicies);
  };

  // Filter active templates and policies
  const activeTemplates = templates.filter((t) => t.active !== false);
  const activePolicies = policies.filter((p) => p.is_active !== false);

  // Group policies by category
  const policiesByCategory = activePolicies.reduce((acc, policy) => {
    const category = policy.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(policy);
    return acc;
  }, {});

  // Get selected template details
  const selectedTemplate = activeTemplates.find((t) => t.id === onboarding.onboarding_template_id);

  return (
    <div className="space-y-6">
      {/* Onboarding Template */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Onboarding Template</CardTitle>
          </div>
          <CardDescription>Select a checklist of tasks for the new hire</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Template</Label>
            <Select
              value={onboarding.onboarding_template_id || 'none'}
              onValueChange={(v) => updateOnboarding('onboarding_template_id', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select onboarding template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template (skip onboarding tasks)</SelectItem>
                {activeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default && ' (Default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-900">{selectedTemplate.name}</p>
              {selectedTemplate.description && (
                <p className="text-sm text-indigo-700 mt-1">{selectedTemplate.description}</p>
              )}
              <div className="flex gap-2 mt-2">
                {selectedTemplate.department && (
                  <Badge variant="secondary">{selectedTemplate.department}</Badge>
                )}
                {selectedTemplate.employment_type && (
                  <Badge variant="outline">{selectedTemplate.employment_type.replace('_', ' ')}</Badge>
                )}
              </div>
            </div>
          )}

          {!onboarding.onboarding_template_id && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-700">
                Without a template, no onboarding tasks will be created. You can still manually add tasks later.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Required Policies */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Policies to Assign</CardTitle>
          </div>
          <CardDescription>
            Select policies the new hire should acknowledge
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(policiesByCategory).length === 0 ? (
            <p className="text-sm text-gray-500">No active policies available.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(policiesByCategory).map(([category, categoryPolicies]) => (
                <div key={category}>
                  <p className="text-sm font-medium text-gray-700 mb-2">{category}</p>
                  <div className="space-y-2">
                    {categoryPolicies.map((policy) => {
                      const isSelected = (onboarding.policy_ids || []).includes(policy.id);
                      return (
                        <div
                          key={policy.id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                          onClick={() => togglePolicy(policy.id)}
                        >
                          <Checkbox
                            id={policy.id}
                            checked={isSelected}
                            onCheckedChange={() => togglePolicy(policy.id)}
                          />
                          <div className="flex-1">
                            <label htmlFor={policy.id} className="text-sm font-medium cursor-pointer">
                              {policy.name}
                              {policy.is_mandatory && (
                                <Badge variant="destructive" className="ml-2 text-xs">
                                  Mandatory
                                </Badge>
                              )}
                            </label>
                            {policy.description && (
                              <p className="text-xs text-gray-500">{policy.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(onboarding.policy_ids?.length || 0) > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                {onboarding.policy_ids.length} {onboarding.policy_ids.length === 1 ? 'policy' : 'policies'} selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Additional Notes</CardTitle>
          </div>
          <CardDescription>Internal notes for onboarding (not visible to new hire)</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={onboarding.notes || ''}
            onChange={(e) => updateOnboarding('notes', e.target.value)}
            placeholder="e.g. Needs special equipment, working from home initially, etc."
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}