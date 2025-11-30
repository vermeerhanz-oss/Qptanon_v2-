import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, Calendar, ArrowRight, Loader2, FileText } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

export default function ReportingOverview() {
  const [context, setContext] = useState(null);

  useEffect(() => {
    getCurrentUserEmployeeContext().then(setContext);
  }, []);

  const { isAllowed, isLoading } = useRequirePermission(context, 'canViewReports');

  if (isLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const reports = [
    {
      title: 'People summary',
      description: 'Headcount, employment types, managers vs ICs.',
      icon: Users,
      page: 'PeopleSummary',
    },
    {
      title: 'Leave summary',
      description: 'Annual leave usage, balances, and trends.',
      icon: Calendar,
      page: 'LeaveSummary',
    },
    {
      title: 'Demographics',
      description: 'Gender, age, employment type, and location breakdown.',
      icon: Users,
      page: 'Demographics',
    },
    {
      title: 'Policy acknowledgements',
      description: 'Track employee policy acknowledgement status.',
      icon: FileText,
      page: 'PolicyAcknowledgementsReport',
      requiresPolicies: true,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Basic Reports</h1>
        </div>
        <p className="text-gray-600">
          Access key HR and people reports to understand your workforce.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.filter(r => !r.requiresPolicies || context?.permissions?.canManagePolicies).map((report) => (
          <Card key={report.page} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <report.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{report.title}</h2>
              </div>
              <p className="text-gray-600 text-sm mb-6">{report.description}</p>
              <Link to={createPageUrl(report.page)}>
                <Button variant="outline" className="w-full">
                  View report
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