import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Plus, Loader2, FileText, History } from 'lucide-react';
import { format } from 'date-fns';
import DocumentVersionUploader from './DocumentVersionUploader';

const DocumentVersion = base44.entities.DocumentVersion;
const Employee = base44.entities.Employee;

export default function DocumentVersionList({ document, currentUser, onVersionAdded }) {
  const [versions, setVersions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [document.id]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const [vers, emps] = await Promise.all([
        DocumentVersion.filter({ document_id: document.id }),
        Employee.list(),
      ]);
      vers.sort((a, b) => b.version_number - a.version_number);
      setVersions(vers);
      setEmployees(emps);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUploaderName = (uploadedById) => {
    const emp = employees.find(e => e.id === uploadedById || e.user_id === uploadedById);
    if (emp) return `${emp.first_name} ${emp.last_name}`;
    return 'Unknown';
  };

  const handleVersionSuccess = () => {
    setShowUploadModal(false);
    loadVersions();
    onVersionAdded?.();
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">Version History</h3>
          </div>
          <Button size="sm" onClick={() => setShowUploadModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Upload New Version
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            <FileText className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            No previous versions
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-20">Version</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map(ver => (
                  <TableRow key={ver.id}>
                    <TableCell>
                      <span className="font-mono text-sm">v{ver.version_number}</span>
                    </TableCell>
                    <TableCell className="font-medium">{ver.file_name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {getUploaderName(ver.uploaded_by_id)}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {ver.created_date ? format(new Date(ver.created_date), 'dd MMM yyyy HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <a href={ver.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload New Version</DialogTitle>
            </DialogHeader>
            <DocumentVersionUploader
              document={document}
              currentUser={currentUser}
              onSuccess={handleVersionSuccess}
              onCancel={() => setShowUploadModal(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}