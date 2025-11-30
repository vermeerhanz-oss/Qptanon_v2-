import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Calendar,
  Briefcase,
  Users,
  ExternalLink
} from 'lucide-react';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { getDisplayName, getInitials } from '@/components/utils/displayName';

export default function EmployeeDrawer({ employee, manager, directReports, onClose }) {
  if (!employee) return null;

  const getTenure = (startDate) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const now = new Date();
    const years = differenceInYears(now, start);
    const months = differenceInMonths(now, start) % 12;
    
    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}, ${months} month${months > 1 ? 's' : ''}`;
    }
    return `${months} month${months > 1 ? 's' : ''}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'onboarding': return 'bg-blue-100 text-blue-700';
      case 'offboarding': return 'bg-orange-100 text-orange-700';
      case 'terminated': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Sheet open={!!employee} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                {getInitials({ first_name: employee.firstName, last_name: employee.lastName, preferred_name: employee.preferredName })}
              </div>
              <div>
                <SheetTitle className="text-xl">
                  {getDisplayName({ first_name: employee.firstName, last_name: employee.lastName, preferred_name: employee.preferredName })}
                </SheetTitle>
                <p className="text-gray-500">{employee.jobTitle}</p>
                <Badge className={`mt-2 ${getStatusColor(employee.status)}`}>
                  {employee.status}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pt-4">
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4">
            {employee.department && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span>{employee.department}</span>
              </div>
            )}
            {employee.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{employee.location}</span>
              </div>
            )}
            {employee.entityName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span>{employee.entityName}</span>
              </div>
            )}
            {employee.startDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{getTenure(employee.startDate)}</span>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Contact</h4>
            {employee.email && (
              <a 
                href={`mailto:${employee.email}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Mail className="h-4 w-4" />
                {employee.email}
              </a>
            )}
            {employee.phone && (
              <a 
                href={`tel:${employee.phone}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Phone className="h-4 w-4" />
                {employee.phone}
              </a>
            )}
          </div>

          {/* Manager */}
          {manager && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Reports to</h4>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                  {getInitials({ first_name: manager.firstName, last_name: manager.lastName, preferred_name: manager.preferredName })}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {getDisplayName({ first_name: manager.firstName, last_name: manager.lastName, preferred_name: manager.preferredName })}
                  </p>
                  <p className="text-xs text-gray-500">{manager.jobTitle}</p>
                </div>
              </div>
            </div>
          )}

          {/* Direct Reports */}
          {directReports && directReports.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Direct Reports ({directReports.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {directReports.map(report => (
                  <div 
                    key={report.id}
                    className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-xs">
                      {getInitials({ first_name: report.firstName, last_name: report.lastName, preferred_name: report.preferredName })}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {getDisplayName({ first_name: report.firstName, last_name: report.lastName, preferred_name: report.preferredName })}
                      </p>
                      <p className="text-xs text-gray-500">{report.jobTitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Full Profile Button */}
          <div className="pt-4 border-t">
            <Link to={createPageUrl('EmployeeProfile') + `?id=${employee.id}`}>
              <Button className="w-full">
                View Full Profile
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}