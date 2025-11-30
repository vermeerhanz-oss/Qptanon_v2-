import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { safeNumber } from '@/components/utils/numberUtils';

const COLORS = {
  annual: '#F59E0B',
  personal: '#F43F5E',
  other: '#6366F1',
};

export default function LeaveSummaryCharts({
  filteredRequests,
  chargeableDaysMap,
  dateRange,
  getLeaveTypeCategory,
}) {
  // Chart 1: Leave by type (donut)
  const leaveByTypeData = useMemo(() => {
    const approvedRequests = filteredRequests.filter(r => r.status === 'approved');
    
    const totals = { annual: 0, personal: 0, other: 0 };
    approvedRequests.forEach(r => {
      const category = getLeaveTypeCategory(r.leave_type_id);
      const days = chargeableDaysMap[r.id] ?? r.total_days ?? 0;
      totals[category] = (totals[category] || 0) + days;
    });

    return [
      { name: 'Annual Leave', value: Number(safeNumber(totals.annual, 0).toFixed(1)), color: COLORS.annual },
      { name: 'Personal Leave', value: Number(safeNumber(totals.personal, 0).toFixed(1)), color: COLORS.personal },
    ].filter(d => d.value > 0);
  }, [filteredRequests, chargeableDaysMap, getLeaveTypeCategory]);

  // Chart 2: Leave over time (monthly)
  const leaveOverTimeData = useMemo(() => {
    const approvedRequests = filteredRequests.filter(r => r.status === 'approved');
    
    // Get all months in range
    const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
    
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      let annualDays = 0;
      let personalDays = 0;
      
      approvedRequests.forEach(r => {
        const reqStart = parseISO(r.start_date);
        const reqEnd = parseISO(r.end_date);
        
        // Check if request overlaps this month
        if (reqStart <= monthEnd && reqEnd >= monthStart) {
          const days = chargeableDaysMap[r.id] ?? r.total_days ?? 0;
          const category = getLeaveTypeCategory(r.leave_type_id);
          
          // Simple attribution: assign to month of start date
          // (More accurate would be to prorate across months)
          if (isWithinInterval(reqStart, { start: monthStart, end: monthEnd })) {
            if (category === 'annual') {
              annualDays += days;
            } else if (category === 'personal') {
              personalDays += days;
            }
          }
        }
      });

      return {
        month: format(month, 'MMM'),
        fullMonth: format(month, 'MMMM yyyy'),
        annual: Number(safeNumber(annualDays, 0).toFixed(1)),
        personal: Number(safeNumber(personalDays, 0).toFixed(1)),
        total: Number(safeNumber(annualDays + personalDays, 0).toFixed(1)),
      };
    });
  }, [filteredRequests, chargeableDaysMap, dateRange, getLeaveTypeCategory]);

  const hasData = leaveByTypeData.length > 0 || leaveOverTimeData.some(d => d.total > 0);

  if (!hasData) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Donut Chart - Leave by Type */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Leave Taken by Type</h3>
          {leaveByTypeData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${value}d`}
                    labelLine={false}
                  >
                    {leaveByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} days`, '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              No leave data for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart - Leave Over Time */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Leave Taken Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaveOverTimeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}d`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value, name) => [`${value} days`, name === 'annual' ? 'Annual' : 'Personal']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonth || label}
                />
                <Bar dataKey="annual" stackId="a" fill={COLORS.annual} radius={[0, 0, 0, 0]} name="Annual" />
                <Bar dataKey="personal" stackId="a" fill={COLORS.personal} radius={[4, 4, 0, 0]} name="Personal" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}