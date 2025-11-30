import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Link2Off } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small Google Workspace status indicator icon for use in tables/lists
 */
export function GoogleStatusIcon({ status, className }) {
  const config = {
    not_linked: { 
      icon: Link2Off, 
      color: 'text-gray-400',
      tooltip: 'Not linked to Google Workspace'
    },
    provisioned: { 
      icon: CheckCircle2, 
      color: 'text-green-500',
      tooltip: 'Google Workspace active'
    },
    suspended: { 
      icon: XCircle, 
      color: 'text-yellow-500',
      tooltip: 'Google Workspace suspended'
    },
    error: { 
      icon: AlertTriangle, 
      color: 'text-red-500',
      tooltip: 'Google Workspace sync error'
    },
  };

  const statusKey = status || 'not_linked';
  const { icon: Icon, color, tooltip } = config[statusKey] || config.not_linked;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={cn("h-4 w-4", color, className)} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default GoogleStatusIcon;