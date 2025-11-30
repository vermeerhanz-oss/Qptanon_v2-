import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';
import { FileText, ExternalLink } from 'lucide-react';
import { canViewDocument } from '@/components/utils/permissions';

const Document = base44.entities.Document;

export function EmployeeDocuments({ employeeId, employee, user, currentEmployee }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docs = await Document.filter({ employee_id: employeeId });
        // Filter by permission
        const visibleDocs = docs.filter(doc => canViewDocument(user, doc, employee, currentEmployee));
        setDocuments(visibleDocs);
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [employeeId, user, employee, currentEmployee]);

  const typeColors = {
    policy: 'danger',
    contract: 'success',
    handbook: 'warning',
    form: 'info',
    other: 'default',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No documents assigned to this employee
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-gray-200">
        {documents.map((doc) => (
          <div key={doc.id} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={typeColors[doc.document_type]}>{doc.document_type}</Badge>
                  <span className="text-xs text-gray-500">
                    Added {format(new Date(doc.created_date), 'dd MMM yyyy')}
                  </span>
                </div>
              </div>
            </div>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}