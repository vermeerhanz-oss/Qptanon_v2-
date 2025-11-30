import React, { useState, useEffect } from 'react';
import { X, Rocket, Zap, MessageSquare, Loader2, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { executeCommand } from './commandExecutor';
import { interpretAndExecute } from './chatInterpreter';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';

export default function AssistantSidebar({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('actions');
  const [context, setContext] = useState(null);

  // Load context on open
  useEffect(() => {
    if (isOpen && !context) {
      getCurrentUserEmployeeContext().then(setContext);
    }
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-[380px] max-w-[90vw] bg-white z-50",
        "shadow-2xl flex flex-col",
        "animate-in slide-in-from-right duration-300"
      )}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">AI Assistant</h2>
            <p className="text-xs text-gray-500">Your HRIS copilot</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-4 grid grid-cols-2">
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="flex-1 overflow-auto p-4 space-y-3">
            <ActionsTab context={context} />
          </TabsContent>

          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden">
            <ChatTab context={context} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function ActionsTab({ context }) {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const permissions = context?.permissions || {};

  return (
    <div className="space-y-2">
      <ActionSection
        title="Create Entity"
        description="Add a new company entity"
        isExpanded={expandedSection === 'create_entity'}
        onToggle={() => toggleSection('create_entity')}
        disabled={!permissions.canManageEntities}
      >
        <CreateEntityForm context={context} onSuccess={() => setExpandedSection(null)} />
      </ActionSection>

      <ActionSection
        title="Add Employee"
        description="Onboard a new team member"
        isExpanded={expandedSection === 'add_employee'}
        onToggle={() => toggleSection('add_employee')}
        disabled={!permissions.canManageOnboarding}
      >
        <AddEmployeeForm context={context} onSuccess={() => setExpandedSection(null)} />
      </ActionSection>

      <ActionSection
        title="Change Reporting Line"
        description="Update manager assignment"
        isExpanded={expandedSection === 'change_reporting_line'}
        onToggle={() => toggleSection('change_reporting_line')}
        disabled={!permissions.canManageCompanySettings}
      >
        <ChangeReportingLineForm context={context} onSuccess={() => setExpandedSection(null)} />
      </ActionSection>
    </div>
  );
}

function ActionSection({ title, description, isExpanded, onToggle, disabled, children }) {
  if (disabled) {
    return (
      <div className="border rounded-lg overflow-hidden opacity-50">
        <div className="flex items-center gap-3 p-3 text-left cursor-not-allowed">
          <ShieldAlert className="h-4 w-4 text-gray-400" />
          <div className="flex-1">
            <p className="font-medium text-gray-500 text-sm">{title}</p>
            <p className="text-xs text-gray-400">Requires admin permissions</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </button>
      {isExpanded && (
        <div className="p-3 pt-0 border-t bg-gray-50">
          {children}
        </div>
      )}
    </div>
  );
}

function CreateEntityForm({ context, onSuccess }) {
  const [payload, setPayload] = useState({ name: '', country: '' });
  const [status, setStatus] = useState({ loading: false, result: null });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, result: null });
    
    const result = await executeCommand({ type: 'create_entity', payload }, context);
    setStatus({ loading: false, result });
    
    if (result.success) {
      setPayload({ name: '', country: '' });
      setTimeout(() => onSuccess(), 1500);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      <div>
        <Label className="text-xs">Entity Name *</Label>
        <Input
          placeholder="ACME Australia"
          value={payload.name}
          onChange={e => setPayload(p => ({ ...p, name: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Country *</Label>
        <Input
          placeholder="Australia"
          value={payload.country}
          onChange={e => setPayload(p => ({ ...p, country: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <ResultMessage status={status} />
      <Button type="submit" size="sm" className="w-full" disabled={status.loading}>
        {status.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Entity'}
      </Button>
    </form>
  );
}

function AddEmployeeForm({ context, onSuccess }) {
  const [payload, setPayload] = useState({
    first_name: '', last_name: '', work_email: '', role_title: '', department: ''
  });
  const [status, setStatus] = useState({ loading: false, result: null });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, result: null });
    
    const result = await executeCommand({ type: 'add_employee', payload }, context);
    setStatus({ loading: false, result });
    
    if (result.success) {
      setPayload({ first_name: '', last_name: '', work_email: '', role_title: '', department: '' });
      setTimeout(() => onSuccess(), 1500);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">First Name *</Label>
          <Input
            placeholder="John"
            value={payload.first_name}
            onChange={e => setPayload(p => ({ ...p, first_name: e.target.value }))}
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Last Name *</Label>
          <Input
            placeholder="Smith"
            value={payload.last_name}
            onChange={e => setPayload(p => ({ ...p, last_name: e.target.value }))}
            className="h-9 mt-1"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Work Email *</Label>
        <Input
          type="email"
          placeholder="john@company.com"
          value={payload.work_email}
          onChange={e => setPayload(p => ({ ...p, work_email: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Role Title *</Label>
        <Input
          placeholder="Software Engineer"
          value={payload.role_title}
          onChange={e => setPayload(p => ({ ...p, role_title: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Department *</Label>
        <Input
          placeholder="Engineering"
          value={payload.department}
          onChange={e => setPayload(p => ({ ...p, department: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <ResultMessage status={status} />
      <Button type="submit" size="sm" className="w-full" disabled={status.loading}>
        {status.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Employee'}
      </Button>
    </form>
  );
}

function ChangeReportingLineForm({ context, onSuccess }) {
  const [payload, setPayload] = useState({ employee_email: '', new_manager_email: '' });
  const [status, setStatus] = useState({ loading: false, result: null });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, result: null });
    
    const result = await executeCommand({ type: 'change_reporting_line', payload }, context);
    setStatus({ loading: false, result });
    
    if (result.success) {
      setPayload({ employee_email: '', new_manager_email: '' });
      setTimeout(() => onSuccess(), 1500);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      <div>
        <Label className="text-xs">Employee Email *</Label>
        <Input
          type="email"
          placeholder="employee@company.com"
          value={payload.employee_email}
          onChange={e => setPayload(p => ({ ...p, employee_email: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">New Manager Email *</Label>
        <Input
          type="email"
          placeholder="manager@company.com"
          value={payload.new_manager_email}
          onChange={e => setPayload(p => ({ ...p, new_manager_email: e.target.value }))}
          className="h-9 mt-1"
        />
      </div>
      <ResultMessage status={status} />
      <Button type="submit" size="sm" className="w-full" disabled={status.loading}>
        {status.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Reporting Line'}
      </Button>
    </form>
  );
}

function ResultMessage({ status }) {
  if (!status.result) return null;

  const isPermissionError = status.result.error?.includes('Permission denied');
  const displayMessage = isPermissionError 
    ? "You don't have permission to perform that action. Please contact an administrator."
    : (status.result.message || status.result.error);

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded text-xs",
      status.result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
    )}>
      {status.result.success ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      ) : isPermissionError ? (
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
      )}
      <span>{displayMessage}</span>
    </div>
  );
}

function ChatTab({ context }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your HRIS assistant. Try:\n• "Create an entity called Acme UK in United Kingdom"\n• "Add employee John Smith as Engineer in Engineering"\n• "Change sarah@co.com to report to alice@co.com"' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const result = await interpretAndExecute(input, context);
      
      // Check for permission errors
      const isPermissionError = result.message?.includes('Permission denied');
      const displayMessage = isPermissionError
        ? "You don't have permission to perform that action. Please contact an administrator."
        : result.message;
      
      const assistantMessage = {
        role: 'assistant',
        content: result.ok 
          ? `✅ ${displayMessage}` 
          : `❌ ${displayMessage}`,
        data: result.data,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Error: ${error.message}` 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === 'user'
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-900"
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Try: Add employee John Smith as Engineer in Engineering"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isProcessing}
          />
          <Button onClick={handleSend} size="icon" disabled={isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

/*
 * FUTURE LLM INTEGRATION:
 * 
 * When implementing the real chat, the flow will be:
 * 
 * 1. User sends natural language message
 * 2. Send to LLM with system prompt that includes command schemas
 * 3. LLM returns structured response:
 *    {
 *      intent: 'execute_command' | 'clarification' | 'information',
 *      command?: { type: 'add_employee', payload: {...} },
 *      message: 'I\'ll add John Smith...'
 *    }
 * 4. If intent is execute_command:
 *    - Show confirmation to user
 *    - On confirm: await executeCommand(command)
 *    - Show result
 * 5. If clarification: show message and wait for more input
 * 6. If information: show informational response
 */