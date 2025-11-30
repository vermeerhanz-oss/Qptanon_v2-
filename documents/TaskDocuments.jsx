import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Upload, FileText, Download, Loader2, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import DocumentUploader from './DocumentUploader';

const Document = base44.entities.Document;

/**
 * TaskDocuments - Shows attached documents and upload button for onboarding/offboarding tasks
 * 
 * @param {string} taskId - The task ID
 * @param {string} taskType - 'onboarding' or 'offboarding'
 * @param {string} ownerEmployeeId - The employee being onboarded/offboarded
 * @param {string} assignedToRole - 'employee', 'manager', 'hr', 'it', 'finance'
 * @param {boolean} canUpload - Whether current user can upload
 * @param {Object} currentUser - Current user object
 */
export default function TaskDocuments({ 
  taskId, 
  taskType, 
  ownerEmployeeId, 
  assignedToRole,
  canUpload,
  currentUser,
  onDocumentAdded
}) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocList, setShowDocList] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [taskId, taskType]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const filterKey = taskType === 'onboarding' 
        ? 'related_onboarding_task_id' 
        : 'related_offboarding_task_id';
      
      const docs = await Document.filter({ [filterKey]: taskId });
      docs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading task documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    loadDocuments();
    onDocumentAdded?.();
  };

  const docCount = documents.length;

  return (
    <div className="flex items-center gap-2">
      {/* Document count badge / popover */}
      {docCount > 0 && (
        <Popover open={showDocList} onOpenChange={setShowDocList}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Paperclip className="h-3 w-3 mr-1" />
              {docCount} doc{docCount !== 1 ? 's' : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 px-2 py-1">Attached Documents</p>
              {documents.map(doc => (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 transition-colors"
                >
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {doc.created_date && format(new Date(doc.created_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Download className="h-3 w-3 text-gray-400" />
                </a>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Upload button */}
      {canUpload && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs"
          onClick={() => setShowUploadModal(true)}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
      )}

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <DocumentUploader
            ownerEmployeeId={ownerEmployeeId}
            currentUser={currentUser}
            defaultCategory={taskType === 'onboarding' ? 'onboarding' : 'offboarding'}
            relatedOnboardingTaskId={taskType === 'onboarding' ? taskId : null}
            relatedOffboardingTaskId={taskType === 'offboarding' ? taskId : null}
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUploadModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}