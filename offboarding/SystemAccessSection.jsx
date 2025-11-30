import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Monitor, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  Mail,
  MessageSquare,
  Cloud,
  Key,
  Database,
  Smartphone
} from 'lucide-react';

// Map common system keywords to icons
const SYSTEM_ICONS = {
  google: Mail,
  gmail: Mail,
  slack: MessageSquare,
  microsoft: Cloud,
  office365: Cloud,
  azure: Cloud,
  aws: Cloud,
  github: Database,
  jira: Database,
  confluence: Database,
  okta: Key,
  sso: Key,
  vpn: Key,
  laptop: Smartphone,
  mobile: Smartphone,
};

const STATUS_CONFIG = {
  not_started: { label: 'Pending', color: 'bg-gray-100 text-gray-600', Icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', Icon: Clock },
  completed: { label: 'Revoked', color: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700', Icon: AlertCircle },
};

/**
 * Extracts system type from task title/description
 */
function detectSystem(task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  
  for (const [keyword, Icon] of Object.entries(SYSTEM_ICONS)) {
    if (text.includes(keyword)) {
      // Capitalize first letter
      const name = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      return { name, Icon };
    }
  }
  
  // Default
  return { name: 'System', Icon: Monitor };
}

/**
 * Displays system access revocation status based on IT tasks
 */
export default function SystemAccessSection({ itTasks = [] }) {
  if (itTasks.length === 0) {
    return null;
  }

  // Group IT tasks that look like access revocation
  const accessTasks = itTasks.filter(t => {
    const text = `${t.title} ${t.description || ''}`.toLowerCase();
    return text.includes('revoke') || 
           text.includes('disable') || 
           text.includes('access') || 
           text.includes('account') ||
           text.includes('remove');
  });

  if (accessTasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="h-4 w-4 text-indigo-600" />
          System Access
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accessTasks.map(task => {
            const system = detectSystem(task);
            const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
            const SystemIcon = system.Icon;
            
            return (
              <div 
                key={task.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-white"
              >
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <SystemIcon className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  <Badge className={`${status.color} text-xs mt-1`}>
                    {status.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Based on IT offboarding tasks. Complete tasks to update status.
        </p>
      </CardContent>
    </Card>
  );
}