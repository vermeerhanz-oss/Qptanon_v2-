import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import PolicyAcknowledgementReport from '@/components/policies/PolicyAcknowledgementReport';

const Policy = base44.entities.Policy;
const PolicyVersion = base44.entities.PolicyVersion;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;
const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const CompanyEntity = base44.entities.CompanyEntity;

export default function PolicyAcknowledgementsReport() {
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [policies, setPolicies] = useState([]);
  const [versions, setVersions] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [entities, setEntities] = useState([]);

  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManagePolicies', {
    requireAdminMode: true,
    message: "You need admin access to view this report."
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

      const [pols, vers, acks, emps, depts, ents] = await Promise.all([
        Policy.filter({ is_active: true }),
        PolicyVersion.list(),
        PolicyAcknowledgement.list(),
        Employee.filter({ status: 'active' }),
        Department.list(),
        CompanyEntity.list(),
      ]);

      setPolicies(pols);
      setVersions(vers);
      setAcknowledgements(acks);
      setEmployees(emps);
      setDepartments(depts);
      setEntities(ents);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Versions for selected policy
  const policyVersions = useMemo(() => {
    if (!selectedPolicyId) return [];
    return versions
      .filter(v => v.policy_id === selectedPolicyId)
      .sort((a, b) => b.version_number - a.version_number);
  }, [selectedPolicyId, versions]);

  // Auto-select latest published version
  useEffect(() => {
    if (policyVersions.length > 0) {
      const published = policyVersions.find(v => v.is_published);
      setSelectedVersionId(published?.id || policyVersions[0].id);
    } else {
      setSelectedVersionId('');
    }
  }, [policyVersions]);

  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);
  const selectedVersion = versions.find(v => v.id === selectedVersionId);

  // Filter acknowledgements for selected version
  const versionAcknowledgements = useMemo(() => {
    if (!selectedVersionId) return [];
    return acknowledgements.filter(a => a.version_id === selectedVersionId);
  }, [acknowledgements, selectedVersionId]);

  if (isLoading || permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={createPageUrl('ReportingOverview')}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Policy Acknowledgements</h1>
        <p className="text-gray-500 mt-1">Track employee acknowledgements across policies.</p>
      </div>

      {/* Policy & Version Selection */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Policy</Label>
              <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Version</Label>
              <Select 
                value={selectedVersionId} 
                onValueChange={setSelectedVersionId}
                disabled={!selectedPolicyId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent>
                  {policyVersions.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version_number} {v.is_published ? '(Published)' : '(Draft)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report */}
      {selectedVersion ? (
        <PolicyAcknowledgementReport
          employees={employees}
          acknowledgements={versionAcknowledgements}
          departments={departments}
          entities={entities}
          latestVersion={selectedVersion}
          policyEntityId={selectedPolicy?.entity_id}
          policyCountry={selectedPolicy?.country}
        />
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Select a policy and version to view the acknowledgement report.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}