import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowLeft, Loader2, MapPin, Briefcase, Calendar } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

export default function Demographics() {
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

  const placeholderSections = [
    { title: 'Gender breakdown', icon: Users, description: 'Distribution of workforce by gender.' },
    { title: 'Age distribution', icon: Calendar, description: 'Workforce age bands and averages.' },
    { title: 'Employment type', icon: Briefcase, description: 'Full-time, part-time, casual, and contractor breakdown.' },
    { title: 'Location distribution', icon: MapPin, description: 'Headcount by entity or office location.' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to={createPageUrl('ReportingOverview')}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reporting
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Demographics</h1>
        </div>
        <p className="text-gray-600">
          View workforce composition by gender, age band, employment type, and location. More detailed visualisations coming soon.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {placeholderSections.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <section.icon className="h-5 w-5 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
              </div>
              <p className="text-gray-500 text-sm mb-4">{section.description}</p>
              <div className="h-24 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-200">
                <span className="text-sm text-gray-400">Chart placeholder</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}