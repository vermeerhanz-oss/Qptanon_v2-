import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronDown, ChevronRight, MapPin, Building2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

function OrgChartNode({ employee, allEmployees, departments, locations, level = 0, highlightedIds = new Set(), managerChainIds = new Set(), locateMeId = null }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const nodeRef = useRef(null);

  // Auto-expand if this node is in the manager chain or is the locate target
  useEffect(() => {
    if (managerChainIds.has(employee.id) || locateMeId === employee.id) {
      setIsExpanded(true);
    }
  }, [managerChainIds, locateMeId, employee.id]);

  // Scroll to this node if it's the locate target
  useEffect(() => {
    if (locateMeId === employee.id && nodeRef.current) {
      setTimeout(() => {
        nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [locateMeId, employee.id]);

  const directReports = useMemo(() => {
    return allEmployees.filter(e => e.manager_id === employee.id);
  }, [allEmployees, employee.id]);

  const hasReports = directReports.length > 0;
  const displayName = employee.preferred_name || `${employee.first_name} ${employee.last_name}`;
  const department = departments.find(d => d.id === employee.department_id);
  const location = locations.find(l => l.id === employee.location_id);
  const isHighlighted = highlightedIds.has(employee.id);
  const isLocateTarget = locateMeId === employee.id;
  const isInManagerChain = managerChainIds.has(employee.id);

  return (
    <div ref={nodeRef} className={`${level > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div className="flex items-start gap-2 py-2">
        {hasReports && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {!hasReports && <div className="w-6" />}

        <Link
          to={createPageUrl(`EmployeeProfile?id=${employee.id}`)}
          className={`flex-1 bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${
            isLocateTarget ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' :
            isInManagerChain ? 'border-blue-300 bg-blue-50/50' :
            isHighlighted ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Avatar firstName={employee.first_name} lastName={employee.last_name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-sm text-gray-600 truncate">{employee.job_title}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {department.name}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {location.name}
                  </span>
                )}
              </div>
            </div>
            {hasReports && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {directReports.length} report{directReports.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </Link>
      </div>

      {hasReports && isExpanded && (
        <div className="space-y-1">
          {directReports.map(report => (
            <OrgChartNode
              key={report.id}
              employee={report}
              allEmployees={allEmployees}
              departments={departments}
              locations={locations}
              level={level + 1}
              highlightedIds={highlightedIds}
              managerChainIds={managerChainIds}
              locateMeId={locateMeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(OrgChartNode);