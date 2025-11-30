import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  Search, 
  Calendar,
  ExternalLink,
  User as UserIcon,
  FileText,
  X
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfDay } from 'date-fns';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { getDisplayName } from '@/components/utils/displayName';
import { exportToCsv } from '@/components/utils/exportCsv';

const AuditEvent = base44.entities.AuditEvent;
const Employee = base44.entities.Employee;
const User = base44.entities.User;

export default function AuditLog() {
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [actorSearch, setActorSearch] = useState('');
  const [relatedEmployeeSearch, setRelatedEmployeeSearch] = useState('');

  // Detail panel
  const [selectedEvent, setSelectedEvent] = useState(null);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManageCompanySettings', {
    requireAdminMode: true,
    message: "You need admin access to view the audit log."
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);

      if (!ctx.permissions?.canManageCompanySettings || ctx.actingMode !== 'admin') {
        setIsLoading(false);
        return;
      }

      const [auditEvents, emps, usrs] = await Promise.all([
        AuditEvent.list('-created_at', 500),
        Employee.list(),
        User.list(),
      ]);

      setEvents(auditEvents);
      setEmployees(emps);
      setUsers(usrs);
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build lookup maps
  const employeeMap = useMemo(() => {
    const map = {};
    employees.forEach(e => { map[e.id] = e; });
    return map;
  }, [employees]);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  // Extract distinct event types and entity types
  const eventTypes = useMemo(() => {
    const types = [...new Set(events.map(e => e.event_type).filter(Boolean))];
    return types.sort();
  }, [events]);

  const entityTypes = useMemo(() => {
    const types = [...new Set(events.map(e => e.entity_type).filter(Boolean))];
    return types.sort();
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Date range
      const eventDate = event.created_at ? new Date(event.created_at) : new Date(event.created_date);
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;
      
      if (fromDate && eventDate < fromDate) return false;
      if (toDate && eventDate > toDate) return false;

      // Event type
      if (eventTypeFilter !== 'all' && event.event_type !== eventTypeFilter) return false;

      // Entity type
      if (entityTypeFilter !== 'all' && event.entity_type !== entityTypeFilter) return false;

      // Actor search
      if (actorSearch) {
        const user = userMap[event.actor_user_id];
        const emp = employeeMap[event.actor_employee_id];
        const actorName = emp ? getDisplayName(emp) : (user?.full_name || user?.email || '');
        if (!actorName.toLowerCase().includes(actorSearch.toLowerCase())) return false;
      }

      // Related employee search
      if (relatedEmployeeSearch) {
        const relEmp = employeeMap[event.related_employee_id];
        const relName = relEmp ? getDisplayName(relEmp) : '';
        if (!relName.toLowerCase().includes(relatedEmployeeSearch.toLowerCase())) return false;
      }

      return true;
    });
  }, [events, dateFrom, dateTo, eventTypeFilter, entityTypeFilter, actorSearch, relatedEmployeeSearch, userMap, employeeMap]);

  const getActorName = (event) => {
    const emp = employeeMap[event.actor_employee_id];
    if (emp) return getDisplayName(emp);
    const user = userMap[event.actor_user_id];
    return user?.full_name || user?.email || 'System';
  };

  const getRelatedEmployeeName = (event) => {
    if (!event.related_employee_id) return '—';
    const emp = employeeMap[event.related_employee_id];
    return emp ? getDisplayName(emp) : event.related_employee_id;
  };

  const formatEventType = (type) => {
    if (!type) return '—';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getEventTypeColor = (type) => {
    if (!type) return 'bg-gray-100 text-gray-700';
    if (type.includes('created') || type.includes('started')) return 'bg-green-100 text-green-700';
    if (type.includes('completed') || type.includes('approved')) return 'bg-blue-100 text-blue-700';
    if (type.includes('cancelled') || type.includes('declined')) return 'bg-red-100 text-red-700';
    if (type.includes('updated') || type.includes('uploaded')) return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getEntityLink = (entityType, entityId) => {
    if (!entityType || !entityId) return null;
    
    switch (entityType) {
      case 'Employee':
        return createPageUrl('EmployeeProfile') + `?id=${entityId}`;
      case 'LeaveRequest':
        return createPageUrl('LeaveApprovals');
      case 'EmployeeOnboarding':
        return createPageUrl('OnboardingManage') + `?id=${entityId}`;
      case 'EmployeeOffboarding':
        return createPageUrl('OffboardingManage') + `?id=${entityId}`;
      case 'Policy':
        return createPageUrl('PolicyDetail') + `?id=${entityId}`;
      case 'PolicyVersion':
        return createPageUrl('PolicyLibrary');
      case 'Document':
      case 'DocumentVersion':
        return null; // No direct link
      case 'CompanyEntity':
        return createPageUrl('Entities');
      default:
        return null;
    }
  };

  const handleExportCsv = () => {
    const columns = [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'actor', label: 'Actor' },
      { key: 'event_type', label: 'Event Type' },
      { key: 'entity_type', label: 'Entity Type' },
      { key: 'entity_id', label: 'Entity ID' },
      { key: 'related_employee', label: 'Related Employee' },
      { key: 'description', label: 'Description' },
    ];

    const rows = filteredEvents.map(event => ({
      timestamp: event.created_at || event.created_date,
      actor: getActorName(event),
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      related_employee: event.related_employee_id ? getRelatedEmployeeName(event) : '',
      description: event.description,
    }));

    exportToCsv(columns, rows, 'audit-log');
  };

  const clearFilters = () => {
    setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
    setEventTypeFilter('all');
    setEntityTypeFilter('all');
    setActorSearch('');
    setRelatedEmployeeSearch('');
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
      <div>
        <Link to={createPageUrl('CompanySettings')}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
            <p className="text-gray-500 mt-1">
              Important changes across employees, leave, onboarding, policies, and documents.
            </p>
          </div>
          <Button onClick={handleExportCsv} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>

            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {eventTypes.map(type => (
                  <SelectItem key={type} value={type}>{formatEventType(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entityTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search actor..."
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                className="pl-9 w-40"
              />
            </div>

            <div className="relative">
              <UserIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Related employee..."
                value={relatedEmployeeSearch}
                onChange={(e) => setRelatedEmployeeSearch(e.target.value)}
                className="pl-9 w-44"
              />
            </div>

            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {filteredEvents.length} of {events.length} events
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Related Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                      No audit events found
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(event => (
                    <tr 
                      key={event.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {format(parseISO(event.created_at || event.created_date), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {getActorName(event)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getEventTypeColor(event.event_type)}>
                          {formatEventType(event.event_type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {event.entity_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {getRelatedEmployeeName(event)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {event.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle>Event Details</SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Event info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Timestamp</p>
                    <p className="text-gray-900">
                      {format(parseISO(selectedEvent.created_at || selectedEvent.created_date), 'dd MMMM yyyy, HH:mm:ss')}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Actor</p>
                    <p className="text-gray-900 font-medium">{getActorName(selectedEvent)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Event Type</p>
                    <Badge className={getEventTypeColor(selectedEvent.event_type)}>
                      {formatEventType(selectedEvent.event_type)}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Entity</p>
                    <p className="text-gray-900">
                      {selectedEvent.entity_type} 
                      <span className="text-gray-400 ml-2 text-sm font-mono">
                        {selectedEvent.entity_id}
                      </span>
                    </p>
                  </div>

                  {selectedEvent.related_employee_id && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Related Employee</p>
                      <p className="text-gray-900">{getRelatedEmployeeName(selectedEvent)}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-gray-900">{selectedEvent.description}</p>
                  </div>
                </div>

                {/* Metadata */}
                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Metadata</p>
                    <div className="bg-gray-50 rounded-lg p-3 border">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(selectedEvent.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Links */}
                <div className="space-y-2 pt-4 border-t">
                  {selectedEvent.related_employee_id && employeeMap[selectedEvent.related_employee_id] && (
                    <Link to={createPageUrl('EmployeeProfile') + `?id=${selectedEvent.related_employee_id}`}>
                      <Button variant="outline" className="w-full justify-start">
                        <UserIcon className="h-4 w-4 mr-2" />
                        Open employee profile
                        <ExternalLink className="h-3 w-3 ml-auto" />
                      </Button>
                    </Link>
                  )}

                  {getEntityLink(selectedEvent.entity_type, selectedEvent.entity_id) && (
                    <Link to={getEntityLink(selectedEvent.entity_type, selectedEvent.entity_id)}>
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        Open {selectedEvent.entity_type.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                        <ExternalLink className="h-3 w-3 ml-auto" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}