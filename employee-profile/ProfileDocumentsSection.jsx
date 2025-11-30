import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { 
  Plus, 
  FileText, 
  Download, 
  Trash2, 
  Calendar,
  AlertCircle,
  Loader2,
  Upload,
  Pencil,
  History,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react';
import { format, isPast, addDays } from 'date-fns';
import DocumentUploader from '@/components/documents/DocumentUploader';
import DocumentVersionUploader from '@/components/documents/DocumentVersionUploader';

const Document = base44.entities.Document;
const Employee = base44.entities.Employee;

const CATEGORIES = [
  { value: 'contract', label: 'Contract' },
  { value: 'visa', label: 'Visa' },
  { value: 'certification', label: 'Certification' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'resume', label: 'Resume / CV' },
  { value: 'id_document', label: 'ID Document' },
  { value: 'tax', label: 'Tax Document' },
  { value: 'other', label: 'Other' },
];

const VISIBILITY_LABELS = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'Admin Only',
};

export default function ProfileDocumentsSection({ 
  employee, 
  canEdit,
  currentUser,
  currentEmployee,
  isAdmin,
  isManagerOfEmployee 
}) {
  const [documents, setDocuments] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  useEffect(() => {
    loadDocuments();
  }, [employee.id]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const [docs, emps] = await Promise.all([
        Document.filter({ owner_employee_id: employee.id }),
        Employee.list(),
      ]);
      setAllEmployees(emps);

      // Filter by visibility based on user's access level
      const visibleDocs = docs.filter(doc => canViewDocument(doc));
      visibleDocs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setDocuments(visibleDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine if current user can view a document based on visibility
  const canViewDocument = (doc) => {
    // Admin/owner can see all
    if (isAdmin) return true;

    // Manager of this employee can see manager and admin visibility
    if (isManagerOfEmployee) {
      return ['manager', 'admin'].includes(doc.visibility);
    }

    // Employee viewing their own documents
    if (currentEmployee?.id === employee.id) {
      return ['employee', 'manager', 'admin'].includes(doc.visibility);
    }

    return false;
  };

  // Determine if current user can edit/delete a document
  const canEditDocument = (doc) => {
    if (isAdmin) return true;
    // Employee can only edit their own employee-visibility docs
    if (currentEmployee?.id === employee.id && doc.visibility === 'employee') {
      return true;
    }
    return false;
  };

  // Determine if user can upload
  const canUpload = () => {
    if (isAdmin) return true;
    // Employee can upload for themselves (employee visibility only)
    if (currentEmployee?.id === employee.id) return true;
    return false;
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await Document.delete(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleAddVersion = (doc) => {
    setSelectedDocument(doc);
    setShowVersionModal(true);
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const warningDate = addDays(new Date(), 30);
    return expiry <= warningDate && !isPast(expiry);
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return isPast(new Date(expiryDate));
  };

  const getCategoryLabel = (value) => {
    return CATEGORIES.find(c => c.value === value)?.label || value || 'Other';
  };

  const getUploaderName = (uploadedById) => {
    const emp = allEmployees.find(e => e.id === uploadedById || e.user_id === uploadedById);
    if (emp) return `${emp.first_name} ${emp.last_name}`;
    return 'Unknown';
  };

  // Apply filters
  const filteredDocuments = documents.filter(doc => {
    if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
    if (visibilityFilter !== 'all' && doc.visibility !== visibilityFilter) return false;
    return true;
  });

  const documentCount = documents.length;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Documents {documentCount > 0 && `(${documentCount})`}
          </h2>
          {canUpload() && (
            <Button size="sm" onClick={() => setShowUploadModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Upload Document
            </Button>
          )}
        </div>

        {/* Filters */}
        {documents.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin Only</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No documents uploaded</p>
            {canUpload() && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowUploadModal(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Upload First Document
              </Button>
            )}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No documents match the selected filters
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Category</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Created</TableHead>
                  {isAdmin && <TableHead>Visibility</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Badge variant="secondary">{getCategoryLabel(doc.category)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="font-medium truncate max-w-[200px]">{doc.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {getUploaderName(doc.uploaded_by_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.effective_date ? format(new Date(doc.effective_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {doc.expiry_date ? (
                        <span className={
                          isExpired(doc.expiry_date) 
                            ? 'text-red-600 text-sm font-medium' 
                            : isExpiringSoon(doc.expiry_date) 
                              ? 'text-orange-600 text-sm font-medium' 
                              : 'text-sm'
                        }>
                          {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
                          {isExpired(doc.expiry_date) && (
                            <AlertCircle className="h-3 w-3 inline ml-1" />
                          )}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {doc.created_date ? format(new Date(doc.created_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {doc.visibility === 'admin' && <EyeOff className="h-3 w-3 mr-1" />}
                          {doc.visibility === 'employee' && <Eye className="h-3 w-3 mr-1" />}
                          {VISIBILITY_LABELS[doc.visibility] || doc.visibility}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        {canEditDocument(doc) && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleAddVersion(doc)}
                              title="Add version"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600"
                              onClick={() => handleDelete(doc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Upload Modal */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <DocumentUploader
              ownerEmployeeId={employee.id}
              currentUser={currentUser}
              onSuccess={() => {
                setShowUploadModal(false);
                loadDocuments();
              }}
              onCancel={() => setShowUploadModal(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Version Upload Modal */}
        <Dialog open={showVersionModal} onOpenChange={setShowVersionModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Version</DialogTitle>
            </DialogHeader>
            {selectedDocument && (
              <DocumentVersionUploader
                document={selectedDocument}
                currentUser={currentUser}
                onSuccess={() => {
                  setShowVersionModal(false);
                  setSelectedDocument(null);
                  loadDocuments();
                }}
                onCancel={() => {
                  setShowVersionModal(false);
                  setSelectedDocument(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}