import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from '../components/ui/Card';
import { Plus, Pencil, Check, X } from 'lucide-react';

const Location = base44.entities.Location;

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', address: '' });
  const [newData, setNewData] = useState({ name: '', address: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      const data = await Location.list();
      setLocations(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newData.name.trim()) return;
    setIsSaving(true);
    try {
      await Location.create({ 
        name: newData.name.trim(), 
        address: newData.address.trim() || null 
      });
      setNewData({ name: '', address: '' });
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      console.error('Error creating location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editData.name.trim()) return;
    setIsSaving(true);
    try {
      await Location.update(id, { 
        name: editData.name.trim(), 
        address: editData.address.trim() || null 
      });
      setEditingId(null);
      await loadData();
    } catch (error) {
      console.error('Error updating location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setEditData({ name: loc.name, address: loc.address || '' });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Location'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Location name"
              value={newData.name}
              onChange={(e) => setNewData({ ...newData, name: e.target.value })}
            />
            <Input
              placeholder="Address (optional)"
              value={newData.address}
              onChange={(e) => setNewData({ ...newData, address: e.target.value })}
            />
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Adding...' : 'Add Location'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 divide-y divide-gray-200">
          {locations.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No locations yet</p>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="p-4">
                {editingId === loc.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      autoFocus
                    />
                    <Input
                      placeholder="Address"
                      value={editData.address}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    />
                    <div className="flex gap-3">
                      <Button onClick={() => handleUpdate(loc.id)} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{loc.name}</span>
                      {loc.address && <p className="text-sm text-gray-500">{loc.address}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}