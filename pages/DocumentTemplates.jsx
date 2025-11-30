import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Loader2, Upload, FileText, MoreHorizontal, Pencil, Archive, 
  RotateCcw, Download, Plus, Filter, Building2, Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

const DocumentTemplate = base44.entities.DocumentTemplate;
const CompanyEntity = base44.entities.CompanyEntity;

const CATEGORIES = [
  { value: 'employment_agreement', label: 'Employment Agreements' },
  { value: 'company_form', label: 'Company Forms' },
  { value: 'safety_document', label: 'Safety Documents' },
  { value: 'misc', label: 'Misc Templates' },
];

const COUNTRIES = [
  { value: 'AU', label: 'Australia' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
];

export default function DocumentTemplates() {
  const [userContext, setUserContext] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [entities, setEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    entity_id: '',
    country: '',
  });
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { isAllowed, isLoading: permLoading } = useRequirePermission(
    userContext, 
    'canManageCompanySettings',
    { requireAdminMode: true, message: "You need admin access to manage document templates." }
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const ctx = await getCurrentUserEmployeeContext();
      setUserContext(ctx);

      const [templateList, entityList] = await Promise.all([
        DocumentTemplate.list(),
        CompanyEntity.list(),
      ]);

      setTemplates(templateList);
      setEntities(entityList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
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

  const openNewModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      entity_id: '',
      country: '',
    });
    setFile(null);
    setFileUrl('');
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      description: template.description || '',
      category: template.category || '',
      entity_id: template.entity_id || '',
      country: template.country || '',
    });
    setFile(null);
    setFileUrl(template.file_url || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    setIsSaving(true);
    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        entity_id: formData.entity_id || null,
        country: formData.country || null,
        file_url: fileUrl || null,
        is_active: true,
      };

      if (editingTemplate) {
        await DocumentTemplate.update(editingTemplate.id, data);
      } else {
        await DocumentTemplate.create(data);
      }

      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (template) => {
    await DocumentTemplate.update(template.id, { is_active: false });
    await loadData();
  };

  const handleRestore = async (template) => {
    await DocumentTemplate.update(template.id, { is_active: true });
    await loadData();
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    if (!showArchived && t.is_active === false) return false;
    if (showArchived && t.is_active !== false) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (entityFilter !== 'all' && t.entity_id !== entityFilter) return false;
    if (countryFilter !== 'all' && t.country !== countryFilter) return false;
    return true;
  });

  const getCategoryLabel = (value) => CATEGORIES.find(c => c.value === value)?.label || value || '-';
  const getCountryLabel = (value) => COUNTRIES.find(c => c.value === value)?.label || value || '-';
  const getEntityName = (id) => entities.find(e => e.id === id)?.name || '-';

  if (isLoading || permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Templates</h1>
          <p className="text-gray-500 text-sm mt-1">Master file repository for HR documents</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Filters:</span>
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map(ent => (
                  <SelectItem key={ent.id} value={ent.id}>{ent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {COUNTRIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant={showArchived ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="h-4 w-4 mr-1" />
              {showArchived ? 'Showing Archived' : 'Show Archived'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {showArchived ? 'No archived templates' : 'No templates found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map(template => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{template.name}</p>
                          {template.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">{template.description}</p>
                          )}
                        </div>
                        {template.is_active === false && (
                          <Badge variant="secondary" className="text-xs">Archived</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(template.category)}</Badge>
                    </TableCell>
                    <TableCell>
                      {template.entity_id ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          {getEntityName(template.entity_id)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Global</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {template.country ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Globe className="h-3 w-3 text-gray-400" />
                          {getCountryLabel(template.country)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {template.updated_date && format(new Date(template.updated_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {template.file_url && (
                            <DropdownMenuItem asChild>
                              <a href={template.file_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEditModal(template)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {template.is_active !== false ? (
                            <DropdownMenuItem onClick={() => handleArchive(template)} className="text-red-600">
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleRestore(template)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upload/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Upload New Template'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Template File</Label>
              {!file && !fileUrl ? (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload PDF or DOCX</p>
                  </div>
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-indigo-600" />
                  )}
                  <span className="text-sm font-medium flex-1 truncate">
                    {file?.name || 'Existing file'}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setFile(null); setFileUrl(''); }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Employment Agreement - Full Time"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this template..."
                rows={2}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData(f => ({ ...f, category: v }))}
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

            {/* Entity & Country */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity (optional)</Label>
                <Select 
                  value={formData.entity_id} 
                  onValueChange={(v) => setFormData(f => ({ ...f, entity_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Global (all entities)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Global (all entities)</SelectItem>
                    {entities.map(ent => (
                      <SelectItem key={ent.id} value={ent.id}>{ent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Country (optional)</Label>
                <Select 
                  value={formData.country} 
                  onValueChange={(v) => setFormData(f => ({ ...f, country: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All countries</SelectItem>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name || isSaving || isUploading}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTemplate ? 'Save Changes' : 'Upload Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}