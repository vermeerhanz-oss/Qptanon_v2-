import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';

const StaffingRule = base44.entities.StaffingRule;
const CompanyEntity = base44.entities.CompanyEntity;
const Department = base44.entities.Department;

export default function StaffingRulesPage() {
  const [context, setContext] = useState(null);
  const [rules, setRules] = useState([]);
  const [entities, setEntities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    entity_id: '',
    department_id: '',
    min_active_headcount: '',
    max_concurrent_leave: '',
    is_active: true,
    notes: '',
  });

  const { isAllowed, isLoading: permLoading } = useRequirePermission(context, 'canManageCompanySettings');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setDataLoading(true);
    
    const ctx = await getCurrentUserEmployeeContext();
    setContext(ctx);
    
    if (!ctx.permissions?.canManageCompanySettings) {
      setDataLoading(false);
      return;
    }
    
    const [rulesData, entitiesData, deptsData] = await Promise.all([
      StaffingRule.list(),
      CompanyEntity.list(),
      Department.list(),
    ]);
    setRules(rulesData);
    setEntities(entitiesData);
    setDepartments(deptsData);
    setDataLoading(false);
  };

  const getEntityName = (id) => {
    if (!id) return 'All Entities';
    const entity = entities.find(e => e.id === id);
    return entity?.name || 'Unknown';
  };

  const getDepartmentName = (id) => {
    if (!id) return 'All Departments';
    const dept = departments.find(d => d.id === id);
    return dept?.name || 'Unknown';
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData({
      entity_id: '',
      department_id: '',
      min_active_headcount: '',
      max_concurrent_leave: '',
      is_active: true,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule) => {
    setEditingRule(rule);
    setFormData({
      entity_id: rule.entity_id || '',
      department_id: rule.department_id || '',
      min_active_headcount: rule.min_active_headcount ?? '',
      max_concurrent_leave: rule.max_concurrent_leave ?? '',
      is_active: rule.is_active ?? true,
      notes: rule.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      entity_id: formData.entity_id || null,
      department_id: formData.department_id || null,
      min_active_headcount: formData.min_active_headcount ? Number(formData.min_active_headcount) : null,
      max_concurrent_leave: formData.max_concurrent_leave ? Number(formData.max_concurrent_leave) : null,
      is_active: formData.is_active,
      notes: formData.notes || null,
    };

    if (editingRule) {
      await StaffingRule.update(editingRule.id, payload);
      toast.success('Rule updated');
    } else {
      await StaffingRule.create(payload);
      toast.success('Rule created');
    }

    setIsDialogOpen(false);
    loadData();
  };

  const handleDelete = async (rule) => {
    if (!confirm('Delete this staffing rule?')) return;
    await StaffingRule.delete(rule.id);
    toast.success('Rule deleted');
    loadData();
  };

  if (dataLoading || permLoading || !isAllowed) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staffing Rules</h1>
          <p className="text-gray-500 mt-1">
            Configure minimum staffing levels and maximum concurrent leave
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No staffing rules configured</p>
              <p className="text-sm">Create a rule to enable staffing clash warnings</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Min Active</TableHead>
                  <TableHead>Max on Leave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{getEntityName(rule.entity_id)}</TableCell>
                    <TableCell>{getDepartmentName(rule.department_id)}</TableCell>
                    <TableCell>
                      {rule.min_active_headcount ?? <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {rule.max_concurrent_leave ?? <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                      {rule.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Staffing Rule' : 'Create Staffing Rule'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Entity</Label>
              <Select
                value={formData.entity_id || 'all'}
                onValueChange={(v) => setFormData({ ...formData, entity_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities (Global)</SelectItem>
                  {entities.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Department</Label>
              <Select
                value={formData.department_id || 'all'}
                onValueChange={(v) => setFormData({ ...formData, department_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Active Headcount</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.min_active_headcount}
                  onChange={(e) => setFormData({ ...formData, min_active_headcount: e.target.value })}
                  placeholder="e.g. 3"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum staff that must be working</p>
              </div>
              <div>
                <Label>Max Concurrent Leave</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.max_concurrent_leave}
                  onChange={(e) => setFormData({ ...formData, max_concurrent_leave: e.target.value })}
                  placeholder="e.g. 2"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Max employees on leave at once</p>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Rule is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}