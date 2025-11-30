import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { COMMAND_TYPES } from '@/components/assistant/commandTypes';
import { executeCommand } from '@/components/assistant/commandExecutor';

export default function AssistantPlayground() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commandType, setCommandType] = useState('create_entity');
  const [payload, setPayload] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        setUser(null);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    // Reset payload when command type changes
    setPayload({});
    setResult(null);
  }, [commandType]);

  const updatePayload = (field, value) => {
    setPayload(prev => ({ ...prev, [field]: value }));
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setResult(null);
    
    try {
      const response = await executeCommand({ type: commandType, payload });
      setResult(response);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Shield className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
        <p className="text-gray-500">This page is restricted to administrators only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assistant Command Playground</h1>
        <p className="text-gray-500 mt-1">Test AI assistant commands before integrating with the chat interface.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Command Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Command Type Selector */}
          <div className="space-y-2">
            <Label>Command Type</Label>
            <Select value={commandType} onValueChange={setCommandType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_entity">create_entity</SelectItem>
                <SelectItem value="add_employee">add_employee</SelectItem>
                <SelectItem value="change_reporting_line">change_reporting_line</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Form Based on Command Type */}
          <div className="space-y-4 pt-4 border-t">
            {commandType === 'create_entity' && (
              <CreateEntityForm payload={payload} onChange={updatePayload} />
            )}
            {commandType === 'add_employee' && (
              <AddEmployeeForm payload={payload} onChange={updatePayload} />
            )}
            {commandType === 'change_reporting_line' && (
              <ChangeReportingLineForm payload={payload} onChange={updatePayload} />
            )}
          </div>

          {/* Execute Button */}
          <div className="pt-4 border-t">
            <Button 
              onClick={handleExecute} 
              disabled={isExecuting}
              className="w-full"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Command
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result Panel */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant={result.success ? 'default' : 'destructive'}>
              <AlertDescription>
                {result.message || result.error}
              </AlertDescription>
            </Alert>
            
            {result.data && (
              <div className="mt-4">
                <Label className="text-sm text-gray-500">Response Data</Label>
                <pre className="mt-2 p-4 bg-gray-50 rounded-lg text-sm overflow-auto max-h-64">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payload Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payload Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-gray-50 rounded-lg text-sm overflow-auto">
            {JSON.stringify({ type: commandType, payload }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateEntityForm({ payload, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input 
          placeholder="ACME Australia Pty Ltd"
          value={payload.name || ''}
          onChange={e => onChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Country *</Label>
        <Input 
          placeholder="Australia"
          value={payload.country || ''}
          onChange={e => onChange('country', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Abbreviation</Label>
        <Input 
          placeholder="ACME-AU"
          value={payload.abbreviation || ''}
          onChange={e => onChange('abbreviation', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Timezone</Label>
        <Input 
          placeholder="Australia/Sydney"
          value={payload.timezone || ''}
          onChange={e => onChange('timezone', e.target.value)}
        />
      </div>
    </div>
  );
}

function AddEmployeeForm({ payload, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>First Name *</Label>
        <Input 
          placeholder="John"
          value={payload.first_name || ''}
          onChange={e => onChange('first_name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Last Name *</Label>
        <Input 
          placeholder="Smith"
          value={payload.last_name || ''}
          onChange={e => onChange('last_name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Work Email *</Label>
        <Input 
          type="email"
          placeholder="john.smith@company.com"
          value={payload.work_email || ''}
          onChange={e => onChange('work_email', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Role Title *</Label>
        <Input 
          placeholder="Software Engineer"
          value={payload.role_title || ''}
          onChange={e => onChange('role_title', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Department *</Label>
        <Input 
          placeholder="Engineering"
          value={payload.department || ''}
          onChange={e => onChange('department', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Entity Name</Label>
        <Input 
          placeholder="ACME Australia"
          value={payload.entity_name || ''}
          onChange={e => onChange('entity_name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Manager Email</Label>
        <Input 
          type="email"
          placeholder="manager@company.com"
          value={payload.manager_email || ''}
          onChange={e => onChange('manager_email', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Location Name</Label>
        <Input 
          placeholder="Sydney Office"
          value={payload.location_name || ''}
          onChange={e => onChange('location_name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Employment Type</Label>
        <Select 
          value={payload.employment_type || ''} 
          onValueChange={v => onChange('employment_type', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full_time">Full Time</SelectItem>
            <SelectItem value="part_time">Part Time</SelectItem>
            <SelectItem value="contractor">Contractor</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input 
          type="date"
          value={payload.start_date || ''}
          onChange={e => onChange('start_date', e.target.value)}
        />
      </div>
    </div>
  );
}

function ChangeReportingLineForm({ payload, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Employee Email *</Label>
        <Input 
          type="email"
          placeholder="employee@company.com"
          value={payload.employee_email || ''}
          onChange={e => onChange('employee_email', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>New Manager Email *</Label>
        <Input 
          type="email"
          placeholder="new.manager@company.com"
          value={payload.new_manager_email || ''}
          onChange={e => onChange('new_manager_email', e.target.value)}
        />
      </div>
    </div>
  );
}