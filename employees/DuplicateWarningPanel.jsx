import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { getMatchTypeLabel } from '@/components/utils/employeeDuplicates';

export function DuplicateWarningPanel({ matches, scenario }) {
  if (!matches || matches.length === 0) return null;

  const hasActiveMatches = matches.some(m => m.statusCategory === 'active');
  const onlyTerminated = !hasActiveMatches && matches.every(m => m.statusCategory === 'terminated');

  return (
    <div className={`rounded-lg border p-4 ${
      hasActiveMatches 
        ? 'bg-yellow-50 border-yellow-200' 
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        {hasActiveMatches ? (
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
        ) : (
          <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
        )}
        <div className="flex-1">
          <h3 className={`font-medium ${hasActiveMatches ? 'text-yellow-800' : 'text-blue-800'}`}>
            {matches.length === 1 
              ? 'Potential Duplicate Found' 
              : `${matches.length} Potential Duplicates Found`}
          </h3>
          <p className={`text-sm mt-1 ${hasActiveMatches ? 'text-yellow-700' : 'text-blue-700'}`}>
            {hasActiveMatches 
              ? 'This person might already exist as an active employee.'
              : 'This person looks like a rehire candidate (previously terminated).'}
          </p>

          <div className="mt-3 space-y-2">
            {matches.map((match) => (
              <div 
                key={match.id} 
                className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {match.first_name} {match.last_name}
                    </span>
                    <Badge variant={match.statusCategory === 'active' ? 'success' : 'default'}>
                      {match.statusCategory === 'active' ? 'Active' : 'Terminated'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{match.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Match: {getMatchTypeLabel(match.matchType)}
                  </p>
                </div>
                <Link
                  to={createPageUrl('EmployeeProfile') + `?id=${match.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>

          {onlyTerminated && (
            <p className="text-sm text-blue-700 mt-3">
              You may wish to reactivate the existing terminated employee instead of creating a new record.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}