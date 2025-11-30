import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle2, Clock, Loader2, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const Policy = base44.entities.Policy;
const PolicyVersion = base44.entities.PolicyVersion;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;

export default function ProfilePoliciesSection({ employee }) {
  const [policies, setPolicies] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (employee?.id) {
      loadPolicyData();
    }
  }, [employee?.id]);

  const loadPolicyData = async () => {
    setIsLoading(true);
    try {
      const [allPolicies, allVersions, empAcks] = await Promise.all([
        Policy.filter({ is_active: true }),
        PolicyVersion.filter({ is_published: true }),
        PolicyAcknowledgement.filter({ employee_id: employee.id }),
      ]);

      // Build acknowledgement map by policy_id
      const ackMap = {};
      for (const ack of empAcks) {
        if (!ackMap[ack.policy_id] || ack.acknowledged_at > ackMap[ack.policy_id].acknowledged_at) {
          ackMap[ack.policy_id] = ack;
        }
      }

      // Build version map by policy_id
      const versionMap = {};
      for (const v of allVersions) {
        versionMap[v.policy_id] = v;
      }

      // Combine data
      const policyList = allPolicies.map(p => ({
        ...p,
        currentVersion: versionMap[p.id] || null,
        acknowledgement: ackMap[p.id] || null,
        isAcknowledged: !!ackMap[p.id],
      }));

      // Sort: mandatory first, then by name
      policyList.sort((a, b) => {
        if (a.is_mandatory !== b.is_mandatory) return a.is_mandatory ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      setPolicies(policyList);
      setAcknowledgements(empAcks);
    } catch (error) {
      console.error('Error loading policy data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const mandatoryPolicies = policies.filter(p => p.is_mandatory);
  const optionalPolicies = policies.filter(p => !p.is_mandatory);
  const acknowledgedCount = policies.filter(p => p.isAcknowledged).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-900">Policy Acknowledgements</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Policies</p>
              <p className="text-2xl font-bold text-gray-900">{policies.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Acknowledged</p>
              <p className="text-2xl font-bold text-green-600">{acknowledgedCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{policies.length - acknowledgedCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mandatory Policies */}
      {mandatoryPolicies.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mandatory Policies</h3>
            <div className="divide-y divide-gray-100">
              {mandatoryPolicies.map(policy => (
                <PolicyRow key={policy.id} policy={policy} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optional Policies */}
      {optionalPolicies.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Policies</h3>
            <div className="divide-y divide-gray-100">
              {optionalPolicies.map(policy => (
                <PolicyRow key={policy.id} policy={policy} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {policies.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">No active policies found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PolicyRow({ policy }) {
  return (
    <div className="py-3 flex items-center justify-between">
      <div className="flex items-start gap-3">
        {policy.isAcknowledged ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
        )}
        <div>
          <p className="font-medium text-gray-900">{policy.name}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {policy.category && <span>{policy.category}</span>}
            {policy.currentVersion && (
              <span>v{policy.currentVersion.version_number}</span>
            )}
            {policy.currentVersion?.document_url && (
              <a 
                href={policy.currentVersion.document_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        {policy.isAcknowledged ? (
          <div>
            <Badge className="bg-green-100 text-green-700">Acknowledged</Badge>
            <p className="text-xs text-gray-400 mt-1">
              {format(parseISO(policy.acknowledgement.acknowledged_at), 'dd MMM yyyy')}
            </p>
          </div>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
        )}
      </div>
    </div>
  );
}