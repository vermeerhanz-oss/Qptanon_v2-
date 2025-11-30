import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { differenceInMonths, differenceInYears } from 'date-fns';
import { getDisplayName, getInitials } from '@/components/utils/displayName';

const DEPARTMENT_COLORS = {
  'Engineering': 'bg-blue-100 text-blue-700',
  'Sales': 'bg-green-100 text-green-700',
  'Marketing': 'bg-purple-100 text-purple-700',
  'Finance': 'bg-yellow-100 text-yellow-700',
  'HR': 'bg-pink-100 text-pink-700',
  'Operations': 'bg-orange-100 text-orange-700',
  'Product': 'bg-indigo-100 text-indigo-700',
  'Design': 'bg-rose-100 text-rose-700',
  'Legal': 'bg-slate-100 text-slate-700',
  'Executive': 'bg-gray-800 text-white',
};

const EMPLOYMENT_TYPE_COLORS = {
  'full_time': 'bg-emerald-100 text-emerald-700',
  'part_time': 'bg-amber-100 text-amber-700',
  'contractor': 'bg-cyan-100 text-cyan-700',
  'casual': 'bg-violet-100 text-violet-700',
};

export default function OrgChartNode({ 
  node, 
  isExpanded, 
  onToggleExpand, 
  hasChildren,
  isHighlighted,
  visualizeBy,
  onNodeClick
}) {
  const getTenure = (startDate) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const now = new Date();
    const years = differenceInYears(now, start);
    const months = differenceInMonths(now, start) % 12;
    
    if (years > 0) {
      return `${years}y ${months}m`;
    }
    return `${months}m`;
  };

  const getEmploymentTypeLabel = (type) => {
    const labels = {
      full_time: 'Full-time',
      part_time: 'Part-time',
      contractor: 'Contractor',
      casual: 'Casual',
    };
    return labels[type] || type;
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'onboarding': return 'bg-blue-500';
      case 'offboarding': return 'bg-orange-500';
      case 'terminated': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getDepartmentColor = (dept) => {
    return DEPARTMENT_COLORS[dept] || 'bg-gray-100 text-gray-700';
  };

  const tenure = getTenure(node.startDate);

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div 
        className={`
          relative bg-white rounded-xl shadow-md border-2 transition-all duration-200 cursor-pointer
          hover:shadow-lg hover:border-blue-300 w-56
          ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 border-blue-500' : 'border-gray-200'}
          ${node.status === 'terminated' ? 'opacity-50' : ''}
        `}
        onClick={() => onNodeClick(node)}
      >
        {/* Status indicator */}
        <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${getStatusIndicator(node.status)}`} />
        
        <div className="p-4">
          {/* Avatar & Name */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {getInitials({ first_name: node.firstName, last_name: node.lastName, preferred_name: node.preferredName })}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {getDisplayName({ first_name: node.firstName, last_name: node.lastName, preferred_name: node.preferredName })}
              </h3>
              <p className="text-xs text-gray-500 truncate">{node.jobTitle}</p>
            </div>
          </div>

          {/* Location & Tenure */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{node.location || 'No location'}</span>
            </div>
            {tenure && (
              <span className="text-gray-400 flex-shrink-0">{tenure}</span>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {node.department && (
              <Badge 
                variant="secondary" 
                className={`text-xs px-2 py-0.5 ${getDepartmentColor(node.department)}`}
              >
                {node.department}
              </Badge>
            )}
            {node.employmentType && (
              <Badge 
                variant="secondary" 
                className={`text-xs px-2 py-0.5 ${EMPLOYMENT_TYPE_COLORS[node.employmentType] || 'bg-gray-100 text-gray-700'}`}
              >
                {getEmploymentTypeLabel(node.employmentType)}
              </Badge>
            )}
          </div>

          {/* Reports count */}
          {node.directReportsCount > 0 && (
            <div className="mt-2 pt-2 border-t text-xs text-gray-400 text-center">
              {node.directReportsCount} direct report{node.directReportsCount > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}