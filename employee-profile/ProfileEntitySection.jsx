import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, Loader2, Building2, AlertTriangle } from 'lucide-react';
import { updateEmployeeWithTracking } from '@/components/automation/profileChangeEngine';

const CompanyEntity = base44.entities.CompanyEntity;

export default function ProfileEntitySection({ employee, entity, canEdit, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [entities, setEntities] = useState([]);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    const ents = await CompanyEntity.filter({ status: 'active' });
    setEntities(ents);
  };

  const startEditing = () => {
    setFormData({
      entity_id: employee.entity_id || '',
    });
    setShowWarning(false);
    setIsEditing(true);
  };

  const handleEntityChange = (value) => {
    setFormData({ ...formData, entity_id: value });
    // Show warning if changing to a different entity
    setShowWarning(value !== employee.entity_id && employee.entity_id);
  };

  const handleSave = async () => {
    if (canEdit !== true) return;
    
    setIsSaving(true);
    try {
      // Use tracking to trigger entity transfer workflows
      await updateEmployeeWithTracking(employee.id, formData);
      await onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Company Entity</h2>
          {canEdit === true && !isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Entity Selection / Display */}
        <div className="mb-6">
          <Label className="text-xs text-gray-500">Legal Entity</Label>
          {isEditing ? (
            <Select 
              value={formData.entity_id} 
              onValueChange={handleEntityChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map(ent => (
                  <SelectItem key={ent.id} value={ent.id}>
                    {ent.name} {ent.abbreviation && `(${ent.abbreviation})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-3 mt-2">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{entity?.name || 'No entity assigned'}</p>
                {entity?.abbreviation && (
                  <Badge variant="outline">{entity.abbreviation}</Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Warning for entity transfer */}
        {showWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Entity Transfer Warning</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Transferring an employee to a different entity will trigger compliance workflows including:
                </p>
                <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside space-y-1">
                  <li>New employment agreement generation</li>
                  <li>Compensation currency review</li>
                  <li>Document requirements update</li>
                  <li>Notification to new entity admin</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Entity Details */}
        {entity && !isEditing && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-gray-500">Country</p>
              <p className="text-gray-900 mt-1">{entity.country || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Timezone</p>
              <p className="text-gray-900 mt-1">{entity.timezone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <Badge 
                variant="secondary" 
                className={entity.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
              >
                {entity.status}
              </Badge>
            </div>
            {entity.tax_identifiers && (
              <div className="md:col-span-3">
                <p className="text-xs text-gray-500">Tax Identifiers</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(entity.tax_identifiers).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}