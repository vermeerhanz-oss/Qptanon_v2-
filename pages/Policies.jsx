import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import { FileText, Check, ExternalLink } from 'lucide-react';
import { canAcknowledgePolicy, canViewDocument } from '@/components/utils/permissions';

const Employee = base44.entities.Employee;
const Document = base44.entities.Document;
const PolicyAcknowledgement = base44.entities.PolicyAcknowledgement;

export default function Policies() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(null);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const emps = await Employee.filter({ email: currentUser.email });
      
      if (emps.length === 0) {
        setIsLoading(false);
        return;
      }

      const emp = emps[0];
      setEmployee(emp);

      // Company-wide policies only (no employee_id)
      const allDocs = await Document.list();
      const companyPolicies = allDocs.filter(doc => 
        !doc.employee_id && canViewDocument(currentUser, doc, null, emp)
      );

      const acks = await PolicyAcknowledgement.filter({ employee_id: emp.id });

      setPolicies(companyPolicies);
      setAcknowledgements(acks);
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcknowledge = async (policy) => {
    // Permission check before acknowledging
    if (!canAcknowledgePolicy(user, policy, employee)) {
      console.error("Permission denied to acknowledge this policy");
      return;
    }

    setAcknowledging(policy.id);
    try {
      await PolicyAcknowledgement.create({
        employee_id: employee.id,
        document_id: policy.id,
        acknowledged_at: new Date().toISOString(),
      });
      await loadData();
    } catch (error) {
      console.error('Error acknowledging policy:', error);
    } finally {
      setAcknowledging(null);
    }
  };

  const isAcknowledged = (policyId) => acknowledgements.some(a => a.document_id === policyId);
  const getAckDate = (policyId) => {
    const ack = acknowledgements.find(a => a.document_id === policyId);
    return ack ? format(new Date(ack.acknowledged_at), 'dd MMM yyyy') : null;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-600 p-4 rounded-lg">
          No employee profile found for your account.
        </div>
      </div>
    );
  }

  const pendingPolicies = policies.filter(p => !isAcknowledged(p.id));
  const acknowledgedPolicies = policies.filter(p => isAcknowledged(p.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Company Policies</h1>

      {pendingPolicies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Acknowledgement</h2>
          <div className="space-y-4">
            {pendingPolicies.map((policy) => (
              <Card key={policy.id} className="border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">{policy.title}</p>
                        {policy.description && (
                          <p className="text-sm text-gray-500 mt-1">{policy.description}</p>
                        )}
                        <a
                          href={policy.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2"
                        >
                          View document <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    {canAcknowledgePolicy(user, policy, employee) && (
                      <Button
                        onClick={() => handleAcknowledge(policy)}
                        disabled={acknowledging === policy.id}
                      >
                        {acknowledging === policy.id ? 'Processing...' : 'I Acknowledge'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {acknowledgedPolicies.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Acknowledged</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-gray-200">
              {acknowledgedPolicies.map((policy) => (
                <div key={policy.id} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-gray-900">{policy.title}</p>
                      <p className="text-xs text-gray-500">Acknowledged on {getAckDate(policy.id)}</p>
                    </div>
                  </div>
                  <a
                    href={policy.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {policies.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            No policies requiring acknowledgement
          </CardContent>
        </Card>
      )}
    </div>
  );
}