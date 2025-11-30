import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Building2, 
  Pencil, 
  Trash2,
  Users,
  Globe,
  Clock,
  Loader2
} from 'lucide-react';

import { logForCurrentUser } from '@/components/utils/audit';

const CompanyEntity = base44.entities.CompanyEntity;
const Employee = base44.entities.Employee;
const Location = base44.entities.Location;

const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
];

export default function Entities() {
  const [entities, setEntities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    country: 'Australia',
    timezone: 'Australia/Sydney',
    default_location_id: '',
    hr_contact_id: '',
    it_contact_id: '',
    tax_identifiers: {},
    status: 'active',
  });

  const [taxFields, setTaxFields] = useState([{ key: '', value: '' }]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ents, emps, locs] = await Promise.all([
        CompanyEntity.list(),
        Employee.filter({ status: 'active' }),
        Location.list(),
      ]);
      setEntities(ents);
      setEmployees(emps);
      setLocations(locs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEntity(null);
    setFormData({
      name: '',
      abbreviation: '',
      country: 'Australia',
      timezone: 'Australia/Sydney',
      default_location_id: '',
      hr_contact_id: '',
      it_contact_id: '',
      tax_identifiers: {},
      status: 'active',
    });
    setTaxFields([{ key: '', value: '' }]);
    setShowModal(true);
  };

  const handleEdit = (entity) => {
    setEditingEntity(entity);
    setFormData({
      name: entity.name || '',
      abbreviation: entity.abbreviation || '',
      country: entity.country || 'Australia',
      timezone: entity.timezone || 'Australia/Sydney',
      default_location_id: entity.default_location_id || '',
      hr_contact_id: entity.hr_contact_id || '',
      it_contact_id: entity.it_contact_id || '',
      tax_identifiers: entity.tax_identifiers || {},
      status: entity.status || 'active',
    });
    
    const taxEntries = Object.entries(entity.tax_identifiers || {});
    setTaxFields(taxEntries.length > 0 
      ? taxEntries.map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }]
    );
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.country) return;

    setIsSubmitting(true);
    try {
      // Build tax identifiers object
      const taxIds = {};
      taxFields.forEach(field => {
        if (field.key && field.value) {
          taxIds[field.key] = field.value;
        }
      });

      const saveData = {
        ...formData,
        tax_identifiers: taxIds,
      };

      if (editingEntity) {
        await CompanyEntity.update(editingEntity.id, saveData);
        
        // Audit log
        await logForCurrentUser({
          eventType: 'entity_updated',
          entityType: 'CompanyEntity',
          entityId: editingEntity.id,
          description: `Updated entity ${saveData.name}`,
        });
      } else {
        const newEntity = await CompanyEntity.create(saveData);
        
        // Audit log
        await logForCurrentUser({
          eventType: 'entity_created',
          entityType: 'CompanyEntity',
          entityId: newEntity.id,
          description: `Created entity ${saveData.name}`,
        });
      }

      await loadData();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving entity:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entity) => {
    // Check if entity has employees
    const entityEmployees = employees.filter(e => e.entity_id === entity.id);
    if (entityEmployees.length > 0) {
      alert(`Cannot delete entity with ${entityEmployees.length} employees. Please reassign employees first.`);
      return;
    }

    if (!confirm('Delete this entity? This cannot be undone.')) return;

    try {
      await CompanyEntity.delete(entity.id);
      await loadData();
    } catch (error) {
      console.error('Error deleting entity:', error);
    }
  };

  const getEmployeeCount = (entityId) => {
    return employees.filter(e => e.entity_id === entityId).length;
  };

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : '—';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Entities</h1>
          <p className="text-gray-500 mt-1">Manage legal entities and their settings</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Entity
        </Button>
      </div>

      {entities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No entities created yet</p>
            <Button variant="outline" className="mt-4" onClick={handleCreate}>
              Create First Entity
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entities.map(entity => (
            <Card key={entity.id} className={entity.status === 'inactive' ? 'opacity-60' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{entity.name}</h3>
                      {entity.abbreviation && (
                        <Badge variant="outline">{entity.abbreviation}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(entity)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-red-600"
                      onClick={() => handleDelete(entity)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Globe className="h-4 w-4" />
                    {entity.country}
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="h-4 w-4" />
                    {entity.timezone}
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Users className="h-4 w-4" />
                    {getEmployeeCount(entity.id)} employees
                  </div>
                </div>

                {entity.tax_identifiers && Object.keys(entity.tax_identifiers).length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-2">Tax Identifiers</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entity.tax_identifiers).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <Badge variant="secondary" className={
                    entity.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }>
                    {entity.status}
                  </Badge>
                  {entity.hr_contact_id && (
                    <span className="text-xs text-gray-500">
                      HR: {getEmployeeName(entity.hr_contact_id)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Entity Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntity ? 'Edit Entity' : 'Create Entity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Entity Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ACME Pty Ltd"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Abbreviation</Label>
              <Input
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                placeholder="ACME"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Country *</Label>
              <Input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Australia"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Timezone</Label>
              <Select 
                value={formData.timezone} 
                onValueChange={(v) => setFormData({ ...formData, timezone: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Default Location</Label>
              <Select 
                value={formData.default_location_id} 
                onValueChange={(v) => setFormData({ ...formData, default_location_id: v })}
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
            </div>

            <div>
              <Label>HR Contact</Label>
              <Select 
                value={formData.hr_contact_id} 
                onValueChange={(v) => setFormData({ ...formData, hr_contact_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select HR contact" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>IT Contact</Label>
              <Select 
                value={formData.it_contact_id} 
                onValueChange={(v) => setFormData({ ...formData, it_contact_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select IT contact" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.job_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tax Identifiers</Label>
              <div className="space-y-2 mt-1">
                {taxFields.map((field, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={field.key}
                      onChange={(e) => {
                        const newFields = [...taxFields];
                        newFields[index].key = e.target.value;
                        setTaxFields(newFields);
                      }}
                      placeholder="ABN"
                      className="flex-1"
                    />
                    <Input
                      value={field.value}
                      onChange={(e) => {
                        const newFields = [...taxFields];
                        newFields[index].value = e.target.value;
                        setTaxFields(newFields);
                      }}
                      placeholder="12 345 678 901"
                      className="flex-1"
                    />
                    {index === taxFields.length - 1 && (
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setTaxFields([...taxFields, { key: '', value: '' }])}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'inactive' })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.country || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEntity ? 'Save Changes' : 'Create Entity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}