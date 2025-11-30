import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Layers, ArrowRight, Loader2 } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

const CompanyEntity = base44.entities.CompanyEntity;
const Location = base44.entities.Location;
const Department = base44.entities.Department;

export default function CompanySettings() {
  const [context, setContext] = useState(null);
  const [stats, setStats] = useState({ entities: 0, locations: 0, departments: 0 });
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

      const [entities, locations, departments] = await Promise.all([
        CompanyEntity.list(),
        Location.list(),
        Department.list(),
      ]);

      setStats({
        entities: entities.length,
        locations: locations.length,
        departments: departments.length,
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
      title: 'Entities',
      description: 'Manage company entities and legal structures.',
      icon: Building2,
      page: 'Entities',
      count: stats.entities,
    },
    {
      title: 'Locations',
      description: 'Manage office locations and work sites.',
      icon: MapPin,
      page: 'Locations',
      count: stats.locations,
    },
    {
      title: 'Departments',
      description: 'Manage departments and teams.',
      icon: Layers,
      page: 'Departments',
      count: stats.departments,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Company & Entities</h1>
        </div>
        <p className="text-gray-600">
          Manage your company structure, entities, locations, and departments.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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