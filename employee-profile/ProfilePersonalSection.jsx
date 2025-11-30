import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { canEditField, SELF_EDITABLE_FIELDS } from '@/components/utils/multiEntityPermissions';
import { getLegalName } from '@/components/utils/displayName';
import { logForCurrentUser } from '@/components/utils/audit';

export default function ProfilePersonalSection({ employee, canEdit, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});

  const startEditing = () => {
    setFormData({
      first_name: employee.first_name || '',
      middle_name: employee.middle_name || '',
      last_name: employee.last_name || '',
      preferred_name: employee.preferred_name || '',
      date_of_birth: employee.date_of_birth || '',
      personal_email: employee.personal_email || '',
      phone: employee.phone || '',
      address_line1: employee.address_line1 || '',
      address_line2: employee.address_line2 || '',
      city: employee.city || '',
      state: employee.state || '',
      postcode: employee.postcode || '',
      country: employee.country || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Filter to only editable fields
      const updates = {};
      const changedFields = [];
      Object.keys(formData).forEach(key => {
        if (canEditField(canEdit, key)) {
          if (formData[key] !== employee[key]) {
            changedFields.push(key);
          }
          updates[key] = formData[key];
        }
      });
      await onUpdate(updates);

      // Audit log if changes were made
      if (changedFields.length > 0) {
        await logForCurrentUser({
          eventType: 'employee_updated',
          entityType: 'Employee',
          entityId: employee.id,
          relatedEmployeeId: employee.id,
          description: `Updated employee ${employee.first_name} ${employee.last_name}`,
          metadata: { changedFields },
        });
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const Field = ({ label, value, field, required }) => {
    const isFieldEditable = canEditField(canEdit, field);
    
    if (isEditing && isFieldEditable) {
      return (
        <div>
          <Label className="text-xs text-gray-500">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            value={formData[field] || ''}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            className="mt-1"
            type={field === 'date_of_birth' ? 'date' : 'text'}
            required={required}
          />
        </div>
      );
    }

    return (
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-gray-900 mt-1">{value || '—'}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
          {canEdit && !isEditing && (
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

        <h3 className="font-medium text-gray-900 mb-4">Name</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Field label="First Name" value={employee.first_name} field="first_name" required />
          <Field label="Middle Name" value={employee.middle_name} field="middle_name" />
          <Field label="Last Name" value={employee.last_name} field="last_name" required />
          <Field label="Preferred Name" value={employee.preferred_name} field="preferred_name" />
        </div>
        
        {!isEditing && (
          <div className="bg-gray-50 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500">Legal Name</p>
            <p className="text-gray-900 font-medium">{getLegalName(employee)}</p>
            {employee.preferred_name && (
              <p className="text-xs text-gray-500 mt-1">
                Displays as "{employee.preferred_name} {employee.last_name}" in the app
              </p>
            )}
          </div>
        )}

        <h3 className="font-medium text-gray-900 mb-4">Contact & Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Field 
            label="Date of Birth" 
            value={employee.date_of_birth ? format(new Date(employee.date_of_birth), 'dd MMM yyyy') : null} 
            field="date_of_birth" 
          />
          <Field label="Work Email" value={employee.email} field="email" />
          <Field label="Personal Email" value={employee.personal_email} field="personal_email" />
          <Field label="Phone" value={employee.phone} field="phone" />
        </div>

        <hr className="my-6" />

        <h3 className="font-medium text-gray-900 mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Field label="Address Line 1" value={employee.address_line1} field="address_line1" />
          </div>
          <Field label="Address Line 2" value={employee.address_line2} field="address_line2" />
          <Field label="City" value={employee.city} field="city" />
          <Field label="State" value={employee.state} field="state" />
          <Field label="Postcode" value={employee.postcode} field="postcode" />
          <Field label="Country" value={employee.country} field="country" />
        </div>

        {canEdit === 'self' && (
          <p className="text-xs text-gray-400 mt-6">
            You can edit: {SELF_EDITABLE_FIELDS.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}