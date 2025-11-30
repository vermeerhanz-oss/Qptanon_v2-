import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from 'lucide-react';
import { getDisplayName } from '@/components/utils/displayName';

const PIPELINE_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
];

const HISTORY_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EXIT_TYPES = [
  { value: 'all', label: 'All exit types' },
  { value: 'voluntary', label: 'Voluntary' },
  { value: 'involuntary', label: 'Involuntary' },
  { value: 'redundancy', label: 'Redundancy' },
  { value: 'other', label: 'Other' },
];

export function OffboardingFilters({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  statusFilter,
  onStatusFilterChange,
  entityId,
  onEntityChange,
  exitTypeFilter,
  onExitTypeChange,
  managerId,
  onManagerChange,
  departments = [],
  entities = [],
  managers = [],
  showEntityFilter = false,
  viewMode = 'pipeline',
}) {
  const statusOptions = viewMode === 'pipeline' ? PIPELINE_STATUSES : HISTORY_STATUSES;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Status */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Exit Type */}
        <Select value={exitTypeFilter} onValueChange={onExitTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="All exit types" />
          </SelectTrigger>
          <SelectContent>
            {EXIT_TYPES.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Department */}
        <Select value={departmentId} onValueChange={onDepartmentChange}>
          <SelectTrigger>
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entity */}
        {showEntityFilter && entities.length > 0 && (
          <Select value={entityId} onValueChange={onEntityChange}>
            <SelectTrigger>
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.abbreviation || e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Manager */}
        {managers.length > 0 && (
          <Select value={managerId} onValueChange={onManagerChange}>
            <SelectTrigger>
              <SelectValue placeholder="All managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All managers</SelectItem>
              {managers.map(m => (
                <SelectItem key={m.id} value={m.id}>{getDisplayName(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}