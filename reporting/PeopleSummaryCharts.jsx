import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const EMPLOYMENT_LABELS = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  casual: 'Casual',
  contractor: 'Contractor',
};

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export default function PeopleSummaryCharts({ employees, entityMap, deptMap }) {
  // Employment type data
  const employmentTypeData = useMemo(() => {
    const counts = {};
    employees.forEach(emp => {
      const type = emp.employment_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: EMPLOYMENT_LABELS[key] || key,
        value,
      }));
  }, [employees]);

  // Determine if we should group by entity or department
  const uniqueEntities = useMemo(() => {
    return new Set(employees.map(e => e.entity_id).filter(Boolean));
  }, [employees]);

  const useEntityGrouping = uniqueEntities.size > 1;

  // Headcount by entity or department
  const headcountData = useMemo(() => {
    const counts = {};
    employees.forEach(emp => {
      if (useEntityGrouping) {
        const entityId = emp.entity_id;
        const entityName = entityMap[entityId]?.name || 'Unassigned';
        counts[entityName] = (counts[entityName] || 0) + 1;
      } else {
        const deptId = emp.department_id;
        const deptName = deptMap[deptId]?.name || 'Unassigned';
        counts[deptName] = (counts[deptName] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees, entityMap, deptMap, useEntityGrouping]);

  if (employees.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Employment Type Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Employment Types</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={employmentTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {employmentTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Headcount by Entity/Location Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {useEntityGrouping ? 'Headcount by Entity' : 'Headcount by Department'}
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headcountData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}