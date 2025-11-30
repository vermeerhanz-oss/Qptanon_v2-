import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Image, File, X, Loader2 } from 'lucide-react';

import { logForCurrentUser } from '@/components/utils/audit';

const DocumentVersion = base44.entities.DocumentVersion;
const Document = base44.entities.Document;

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  return File;
}

export default function DocumentVersionUploader({ document, currentUser, onSuccess, onCancel }) {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextVersion, setNextVersion] = useState(1);

  useEffect(() => {
    loadVersionCount();
  }, [document.id]);

  const loadVersionCount = async () => {
    const versions = await DocumentVersion.filter({ document_id: document.id });
    setNextVersion(versions.length + 1);
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(file_url);
    } catch (error) {
      console.error('Error uploading file:', error);
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileUrl('');
  };

  const handleSubmit = async () => {
    if (!fileUrl || !file) return;

    setIsSubmitting(true);
    try {
      // Create version record
      const newVersion = await DocumentVersion.create({
        document_id: document.id,
        version_number: nextVersion,
        file_url: fileUrl,
        file_name: file.name,
        uploaded_by_id: currentUser?.id || null,
        notes: notes || null,
      });

      // Update main document with new file
      await Document.update(document.id, {
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      });

      // Audit log
      await logForCurrentUser({
        eventType: 'document_version_uploaded',
        entityType: 'DocumentVersion',
        entityId: newVersion.id,
        relatedEmployeeId: document.owner_employee_id || null,
        description: `Uploaded new version for document "${document.file_name}"`,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error creating version:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const FileIcon = getFileIcon(file?.type);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">Current file:</p>
        <p className="font-medium text-gray-900">{document.file_name}</p>
        <p className="text-xs text-gray-500 mt-1">New version will be #{nextVersion}</p>
      </div>

      {/* File Upload Area */}
      {!file ? (
        <label className="block cursor-pointer">
          <input type="file" onChange={handleFileChange} className="hidden" />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">Click to upload new version</p>
          </div>
        </label>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                ) : (
                  <FileIcon className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRemoveFile} disabled={isUploading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {file && fileUrl && (
        <div className="space-y-2">
          <Label>Version Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What changed in this version..."
            rows={3}
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!fileUrl || isUploading || isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Version
        </Button>
      </div>
    </div>
  );
}