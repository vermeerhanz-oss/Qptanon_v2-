import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ArrowUpDown, Download, Users, Clock } from 'lucide-react';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { getBalancesForEmployee } from '@/components/utils/LeaveEngine';
import { hoursToDays } from '@/components/utils/leaveAccrual';
import { formatDays, formatHours, safeNumber } from '@/components/utils/numberUtils';
import { getDisplayName } from '@/components/utils/displayName';
import { exportToCsv } from '@/components/utils/exportCsv';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;

export default function LeaveSummaryReport() {
  const { isAuthorized, isLoading: permissionLoading } = useRequirePermission('admin');
  
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [balances, setBalances] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [emps, depts] = await Promise.all([
        Employee.filter({ status: 'active' }),
        Department.list(),
      ]);
      setEmployees(emps);
      setDepartments(depts);

      // Load balances for all employees
      const balanceMap = {};
      await Promise.all(
        emps.map(async (emp) => {
          try {
            const bal = await getBalancesForEmployee(emp.id);
            balanceMap[emp.id] = bal;
          } catch (err) {
            console.error(`Error loading balance for ${emp.id}:`, err);
            balanceMap[emp.id] = { annual: null, personal: null };
          }
        })
      );
      setBalances(balanceMap);
    } catch (error) {
      console.error('Error loading leave summary data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeptName = (id) => departments.find(d => d.id === id)?.name || '—';

  // Process employees with their balances
  const processedEmployees = useMemo(() => {
    return employees.map(emp => {
      const bal = balances[emp.id] || {};
      const annualHours = safeNumber(bal.annual?.availableHours ?? bal.annual?.available_hours, 0);
      const personalHours = safeNumber(bal.personal?.availableHours ?? bal.personal?.available_hours, 0);
      
      // Use standard 7.6 hours per day for display
      const hoursPerDay = 7.6;
      const annualDays = safeNumber(hoursToDays(annualHours, hoursPerDay), 0);
      const personalDays = safeNumber(hoursToDays(personalHours, hoursPerDay), 0);

      return {
        ...emp,
        displayName: getDisplayName(emp),
        deptName: getDeptName(emp.department_id),
        annualHours,
        annualDays,
        personalHours,
        personalDays,
      };
    });
  }, [employees, balances, departments]);

  // Filter and sort
  const filteredEmployees = useMemo(() => {
    let result = processedEmployees;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(emp =>
        emp.displayName.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
      );
    }

    // Department filter
    if (departmentFilter !== 'all') {
      result = result.filter(emp => emp.department_id === departmentFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = a.displayName.toLowerCase();
          valB = b.displayName.toLowerCase();
          break;
        case 'department':
          valA = a.deptName.toLowerCase();
          valB = b.deptName.toLowerCase();
          break;
        case 'annual':
          valA = a.annualDays;
          valB = b.annualDays;
          break;
        case 'personal':
          valA = a.personalDays;
          valB = b.personalDays;
          break;
        default:
          valA = a.displayName.toLowerCase();
          valB = b.displayName.toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [processedEmployees, search, departmentFilter, sortField, sortDir]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalAnnualHours = filteredEmployees.reduce((sum, emp) => sum + emp.annualHours, 0);
    const totalPersonalHours = filteredEmployees.reduce((sum, emp) => sum + emp.personalHours, 0);
    const hoursPerDay = 7.6;

    return {
      annualHours: totalAnnualHours,
      annualDays: safeNumber(hoursToDays(totalAnnualHours, hoursPerDay), 0),
      personalHours: totalPersonalHours,
      personalDays: safeNumber(hoursToDays(totalPersonalHours, hoursPerDay), 0),
      employeeCount: filteredEmployees.length,
    };
  }, [filteredEmployees]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortButton = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-indigo-600' : 'text-gray-400'}`} />
    </button>
  );

  const handleDownloadCsv = () => {
    const columns = [
      { key: 'name', label: 'Employee' },
      { key: 'email', label: 'Email' },
      { key: 'employment_type', label: 'Employment Type' },
      { key: 'department', label: 'Department' },
      { key: 'annual_days', label: 'Annual Leave (days)' },
      { key: 'annual_hours', label: 'Annual Leave (hours)' },
      { key: 'personal_days', label: 'Personal Leave (days)' },
      { key: 'personal_hours', label: 'Personal Leave (hours)' },
    ];

    const rows = filteredEmployees.map(emp => ({
      name: emp.displayName,
      email: emp.email || '',
      employment_type: emp.employment_type?.replace('_', ' ') || 'Full time',
      department: emp.deptName,
      annual_days: emp.employment_type === 'casual' ? '' : formatDays(emp.annualDays),
      annual_hours: emp.employment_type === 'casual' ? '' : formatHours(emp.annualHours),
      personal_days: emp.employment_type === 'casual' ? '' : formatDays(emp.personalDays),
      personal_hours: emp.employment_type === 'casual' ? '' : formatHours(emp.personalHours),
    }));

    exportToCsv({ filename: 'leave-summary', columns, rows });
  };

  if (permissionLoading || isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // useRequirePermission handles redirect
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Summary</h1>
          <p className="text-gray-500 mt-1">Overview of employee annual and personal leave balances</p>
        </div>
        <Button variant="outline" onClick={handleDownloadCsv}>
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Employees</p>
                <p className="text-2xl font-bold text-gray-900">{totals.employeeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Annual Leave</p>
                <p className="text-2xl font-bold text-gray-900">{formatDays(totals.annualDays)} days</p>
                <p className="text-xs text-gray-400">{formatHours(totals.annualHours)} hours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Personal Leave</p>
                <p className="text-2xl font-bold text-gray-900">{formatDays(totals.personalDays)} days</p>
                <p className="text-xs text-gray-400">{formatHours(totals.personalHours)} hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortButton field="name">Employee</SortButton>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <SortButton field="department">Department</SortButton>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <SortButton field="annual">Annual Leave</SortButton>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  <SortButton field="personal">Personal Leave</SortButton>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.displayName}</p>
                      <p className="text-xs text-gray-500">{emp.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 capitalize">
                      {emp.employment_type?.replace('_', ' ') || 'Full time'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {emp.deptName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {emp.employment_type === 'casual' ? (
                      <span className="text-sm text-gray-400">—</span>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{formatDays(emp.annualDays)} days</p>
                        <p className="text-xs text-gray-500">{formatHours(emp.annualHours)} hrs</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {emp.employment_type === 'casual' ? (
                      <span className="text-sm text-gray-400">—</span>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{formatDays(emp.personalDays)} days</p>
                        <p className="text-xs text-gray-500">{formatHours(emp.personalHours)} hrs</p>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900" colSpan={3}>
                  Total ({totals.employeeCount} employees)
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatDays(totals.annualDays)} days</p>
                  <p className="text-xs text-gray-500">{formatHours(totals.annualHours)} hrs</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatDays(totals.personalDays)} days</p>
                  <p className="text-xs text-gray-500">{formatHours(totals.personalHours)} hrs</p>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}