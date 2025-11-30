import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Filter, X, Palette } from 'lucide-react';

export default function OrgChartFilters({
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectSearchResult,
  filters,
  onFiltersChange,
  visualizeBy,
  onVisualizeByChange,
  entities,
  departments,
  locations
}) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [
    filters.entity !== 'all',
    filters.department !== 'all',
    filters.location !== 'all',
    filters.status.length < 4
  ].filter(Boolean).length;

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'offboarding', label: 'Offboarding' },
    { value: 'terminated', label: 'Terminated' },
  ];

  const toggleStatus = (status) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatus });
  };

  const clearFilters = () => {
    onFiltersChange({
      entity: 'all',
      department: 'all',
      location: 'all',
      status: ['active', 'onboarding', 'offboarding', 'terminated']
    });
  };

  return (
    <div className="bg-white border-b px-6 py-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search people by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
          
          {/* Search Results Dropdown */}
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-30 max-h-64 overflow-auto">
              {searchResults.slice(0, 8).map(result => (
                <button
                  key={result.id}
                  onClick={() => onSelectSearchResult(result)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium">
                    {result.firstName?.[0]}{result.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{result.firstName} {result.lastName}</p>
                    <p className="text-xs text-gray-500">{result.jobTitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters Button */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              {/* Entity Filter */}
              <div>
                <Label className="text-sm">Entity</Label>
                <Select 
                  value={filters.entity} 
                  onValueChange={(v) => onFiltersChange({ ...filters, entity: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {entities.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.abbreviation || e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
              <div>
                <Label className="text-sm">Department</Label>
                <Select 
                  value={filters.department} 
                  onValueChange={(v) => onFiltersChange({ ...filters, department: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div>
                <Label className="text-sm">Location</Label>
                <Select 
                  value={filters.location} 
                  onValueChange={(v) => onFiltersChange({ ...filters, location: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <Label className="text-sm">Status</Label>
                <div className="mt-2 space-y-2">
                  {STATUS_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`status-${opt.value}`}
                        checked={filters.status.includes(opt.value)}
                        onCheckedChange={() => toggleStatus(opt.value)}
                      />
                      <label htmlFor={`status-${opt.value}`} className="text-sm">
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Visualize By */}
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-gray-400" />
          <Select value={visualizeBy} onValueChange={onVisualizeByChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">By Department</SelectItem>
              <SelectItem value="entity">By Entity</SelectItem>
              <SelectItem value="location">By Location</SelectItem>
              <SelectItem value="employment_type">By Employment Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {filters.entity !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Entity: {entities.find(e => e.id === filters.entity)?.abbreviation || 'Selected'}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onFiltersChange({ ...filters, entity: 'all' })}
                />
              </Badge>
            )}
            {filters.department !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Dept: {departments.find(d => d.id === filters.department)?.name || 'Selected'}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onFiltersChange({ ...filters, department: 'all' })}
                />
              </Badge>
            )}
            {filters.location !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Location: {locations.find(l => l.id === filters.location)?.name || 'Selected'}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onFiltersChange({ ...filters, location: 'all' })}
                />
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}