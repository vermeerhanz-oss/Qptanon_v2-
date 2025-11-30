import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Loader2, MapPin, Clock, Globe } from 'lucide-react';
import { updateEmployeeWithTracking } from '@/components/automation/profileChangeEngine';

const Location = base44.entities.Location;

export default function ProfileLocationSection({ employee, location, canEdit, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const locs = await Location.list();
    setLocations(locs);
  };

  const startEditing = () => {
    setFormData({
      location_id: employee.location_id || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (canEdit !== true) return;
    
    setIsSaving(true);
    try {
      // Use tracking to trigger relocation compliance tasks
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
          <h2 className="text-lg font-semibold text-gray-900">Work Location</h2>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Location */}
          <div>
            <Label className="text-xs text-gray-500">Office Location</Label>
            {isEditing ? (
              <Select 
                value={formData.location_id} 
                onValueChange={(v) => setFormData({ ...formData, location_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                {location?.name || '—'}
              </p>
            )}
          </div>

          {/* Address */}
          {location && (
            <div>
              <Label className="text-xs text-gray-500">Address</Label>
              <p className="text-gray-900 mt-1">
                {[
                  location.address_line1,
                  location.address_line2,
                  location.suburb,
                  location.state,
                  location.postcode,
                ].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          )}

          {/* Timezone */}
          {location?.timezone && (
            <div>
              <Label className="text-xs text-gray-500">Timezone</Label>
              <p className="text-gray-900 mt-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                {location.timezone}
              </p>
            </div>
          )}

          {/* Country */}
          {location?.country && (
            <div>
              <Label className="text-xs text-gray-500">Country</Label>
              <p className="text-gray-900 mt-1 flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                {location.country}
              </p>
            </div>
          )}
        </div>

        {canEdit === true && (
          <p className="text-xs text-gray-400 mt-6">
            Note: Changing an employee's work location will trigger compliance review tasks.
          </p>
        )}
      </CardContent>
    </Card>
  );
}