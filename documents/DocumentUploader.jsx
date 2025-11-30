import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, FileText, Image, File, X, Loader2, Plus, Calendar
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { logForCurrentUser } from '@/components/utils/audit';

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

const VISIBILITY_OPTIONS = [
  { value: 'employee', label: 'Employee', description: 'Visible to the employee and above' },
  { value: 'manager', label: 'Manager', description: 'Visible to managers and admins' },
  { value: 'admin', label: 'Admin Only', description: 'Visible to admins only' },
];

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

export default function DocumentUploader({ 
  ownerEmployeeId, 
  currentUser,
  defaultCategory,
  relatedOnboardingTaskId,
  relatedOffboardingTaskId,
  relatedPolicyVersionId,
  onSuccess, 
  onCancel 
}) {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    category: defaultCategory || '',
    visibility: 'admin',
    tags: [],
    effective_date: null,
    expiry_date: null,
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');

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

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(f => ({ ...f, tags: [...f.tags, tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(f => ({ ...f, tags: f.tags.filter(t => t !== tagToRemove) }));
  };

  const handleSubmit = async () => {
    if (!fileUrl || !file) return;

    setIsSubmitting(true);
    try {
      const newDoc = await base44.entities.Document.create({
        owner_employee_id: ownerEmployeeId || null,
        uploaded_by_id: currentUser?.id || null,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        category: formData.category || null,
        visibility: formData.visibility,
        tags: formData.tags.length > 0 ? formData.tags : null,
        effective_date: formData.effective_date ? format(formData.effective_date, 'yyyy-MM-dd') : null,
        expiry_date: formData.expiry_date ? format(formData.expiry_date, 'yyyy-MM-dd') : null,
        notes: formData.notes || null,
        related_onboarding_task_id: relatedOnboardingTaskId || null,
        related_offboarding_task_id: relatedOffboardingTaskId || null,
        related_policy_version_id: relatedPolicyVersionId || null,
      });

      // Audit log
      await logForCurrentUser({
        eventType: 'document_uploaded',
        entityType: 'Document',
        entityId: newDoc.id,
        relatedEmployeeId: ownerEmployeeId || null,
        description: `Uploaded document "${file.name}" (${formData.category || 'uncategorized'})`,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const FileIcon = getFileIcon(file?.type);

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      {!file ? (
        <label className="block cursor-pointer">
          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
            <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">Click to upload a file</p>
            <p className="text-xs text-gray-500 mt-1">PDF, DOC, Images up to 10MB</p>
          </div>
        </label>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* File Preview/Icon */}
              <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                ) : file.type.startsWith('image/') && fileUrl ? (
                  <img src={fileUrl} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <FileIcon className="h-6 w-6 text-gray-500" />
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Fields */}
      {file && fileUrl && (
        <div className="space-y-4">
          {/* Category & Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(val) => setFormData(f => ({ ...f, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select 
                value={formData.visibility} 
                onValueChange={(val) => setFormData(f => ({ ...f, visibility: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.effective_date ? format(formData.effective_date, 'dd MMM yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.effective_date}
                    onSelect={(date) => setFormData(f => ({ ...f, effective_date: date }))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Expiry Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.expiry_date ? format(formData.expiry_date, 'dd MMM yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.expiry_date}
                    onSelect={(date) => setFormData(f => ({ ...f, expiry_date: date }))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add any notes about this document..."
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!fileUrl || isUploading || isSubmitting}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Upload Document
        </Button>
      </div>
    </div>
  );
}