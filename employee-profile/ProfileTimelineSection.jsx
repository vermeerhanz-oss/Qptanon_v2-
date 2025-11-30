import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2, 
  UserPlus,
  UserMinus,
  UserCheck,
  Pencil,
  Calendar,
  CalendarCheck,
  CalendarX,
  XCircle,
  FileText,
  Upload,
  CheckCircle2,
  PlayCircle,
  Shield,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

const AuditEvent = base44.entities.AuditEvent;

// Event types that are safe for staff to see on their own profile
const STAFF_SAFE_EVENTS = [
  'employee_created',
  'leave_requested',
  'leave_approved',
  'leave_declined',
  'leave_cancelled',
  'onboarding_started',
  'onboarding_task_completed',
  'onboarding_completed',
  'policy_acknowledged',
  'document_uploaded',
];

// Event types visible to managers
const MANAGER_VISIBLE_EVENTS = [
  ...STAFF_SAFE_EVENTS,
  'employee_updated',
  'offboarding_started',
  'offboarding_task_completed',
  'offboarding_completed',
  'offboarding_cancelled',
];

// All event types for admins (no filter)

export default function ProfileTimelineSection({ employee, viewerRole = 'admin' }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, [employee.id, viewerRole]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const allEvents = await AuditEvent.filter({ related_employee_id: employee.id }, '-created_at', 100);
      
      // Filter based on viewer role
      let filteredEvents = allEvents;
      if (viewerRole === 'staff') {
        filteredEvents = allEvents.filter(e => STAFF_SAFE_EVENTS.includes(e.event_type));
      } else if (viewerRole === 'manager') {
        filteredEvents = allEvents.filter(e => MANAGER_VISIBLE_EVENTS.includes(e.event_type));
      }
      // admin sees all

      setEvents(filteredEvents);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (eventType) => {
    const iconClass = "h-4 w-4";
    
    switch (eventType) {
      case 'employee_created':
        return <UserPlus className={`${iconClass} text-green-600`} />;
      case 'employee_updated':
        return <Pencil className={`${iconClass} text-amber-600`} />;
      case 'leave_requested':
        return <Calendar className={`${iconClass} text-blue-600`} />;
      case 'leave_approved':
        return <CalendarCheck className={`${iconClass} text-green-600`} />;
      case 'leave_declined':
        return <CalendarX className={`${iconClass} text-red-600`} />;
      case 'leave_cancelled':
        return <XCircle className={`${iconClass} text-gray-500`} />;
      case 'onboarding_started':
        return <PlayCircle className={`${iconClass} text-blue-600`} />;
      case 'onboarding_task_completed':
        return <CheckCircle2 className={`${iconClass} text-blue-500`} />;
      case 'onboarding_completed':
        return <UserCheck className={`${iconClass} text-green-600`} />;
      case 'offboarding_started':
        return <UserMinus className={`${iconClass} text-orange-600`} />;
      case 'offboarding_task_completed':
        return <CheckCircle2 className={`${iconClass} text-orange-500`} />;
      case 'offboarding_completed':
        return <UserMinus className={`${iconClass} text-red-600`} />;
      case 'offboarding_cancelled':
        return <XCircle className={`${iconClass} text-gray-500`} />;
      case 'policy_acknowledged':
        return <Shield className={`${iconClass} text-indigo-600`} />;
      case 'document_uploaded':
      case 'document_version_uploaded':
        return <Upload className={`${iconClass} text-purple-600`} />;
      default:
        return <FileText className={`${iconClass} text-gray-500`} />;
    }
  };

  const getEventColor = (eventType) => {
    if (eventType?.includes('created') || eventType?.includes('approved') || eventType?.includes('completed')) {
      return 'bg-green-100 border-green-200';
    }
    if (eventType?.includes('declined') || eventType?.includes('cancelled')) {
      return 'bg-red-50 border-red-200';
    }
    if (eventType?.includes('started') || eventType?.includes('requested')) {
      return 'bg-blue-50 border-blue-200';
    }
    if (eventType?.includes('updated') || eventType?.includes('uploaded')) {
      return 'bg-amber-50 border-amber-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No activity recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Activity Timeline</h2>
        
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {events.map((event, index) => {
              const eventDate = event.created_at ? parseISO(event.created_at) : parseISO(event.created_date);
              
              return (
                <div key={event.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center border ${getEventColor(event.event_type)}`}>
                    {getEventIcon(event.event_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-900">{event.description}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-gray-500">
                        {formatDistanceToNow(eventDate, { addSuffix: true })}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(eventDate, 'dd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}