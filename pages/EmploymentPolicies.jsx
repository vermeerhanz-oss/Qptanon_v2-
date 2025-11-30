import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

const LeavePolicy = base44.entities.LeavePolicy;
const PublicHoliday = base44.entities.PublicHoliday;

export default function EmploymentPolicies() {
  const [context, setContext] = useState(null);
  const [stats, setStats] = useState({ leavePolicies: 0, holidays: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManageCompanySettings');

  useEffect(() => {
    async function load() {
      const ctx = await getCurrentUserEmployeeContext();
      setContext(ctx);

      if (!ctx.permissions?.canManageCompanySettings) {
        setDataLoading(false);
        return;
      }

      const [policies, holidays] = await Promise.all([
        LeavePolicy.list(),
        PublicHoliday.list(),
      ]);

      setStats({
        leavePolicies: policies.length,
        holidays: holidays.length,
      });
      setDataLoading(false);
    }
    load();
  }, []);

  if (dataLoading || permLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const sections = [
    {
      title: 'Leave Policies',
      description: 'Configure annual, personal, and long service leave policies.',
      icon: FileText,
      page: 'LeavePolicies',
      count: stats.leavePolicies,
    },
    {
      title: 'Public Holidays',
      description: 'Manage public holiday calendars by location.',
      icon: Calendar,
      page: 'PublicHolidays',
      count: stats.holidays,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Employment Policies</h1>
        </div>
        <p className="text-gray-600">
          Configure leave policies, work hours, and public holidays.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <Card key={section.page} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <section.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  <span className="text-sm text-gray-500">{section.count} configured</span>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-6">{section.description}</p>
              <Link to={createPageUrl(section.page)}>
                <Button variant="outline" className="w-full">
                  Manage
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}