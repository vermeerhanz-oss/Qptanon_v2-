import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';

/**
 * Calendar Filters component for department and status filtering
 */
export default function CalendarFilters({
  departments = [],
  employees = [],
  selectedDepartment,
  onDepartmentChange,
  selectedStatus,
  onStatusChange,
  selectedEmployees = [],
  onEmployeeChange,
  onClearFilters,
  hasActiveFilters = false,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Filter className="h-4 w-4" />
        Filters:
      </div>
      
      {/* Department filter */}
      <Select value={selectedDepartment || 'all'} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={selectedStatus || 'all'} onValueChange={onStatusChange}>
        <SelectTrigger className="w-40 h-8 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="approved">Approved only</SelectItem>
          <SelectItem value="pending">Pending only</SelectItem>
        </SelectContent>
      </Select>

      {/* Employee filter (if few employees) */}
      {employees.length > 0 && employees.length <= 20 && (
        <Select 
          value={selectedEmployees.length === 1 ? selectedEmployees[0] : 'all'} 
          onValueChange={(val) => onEmployeeChange(val === 'all' ? [] : [val])}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.preferred_name || emp.first_name} {emp.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-8 px-2 text-gray-500 hover:text-gray-700"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}