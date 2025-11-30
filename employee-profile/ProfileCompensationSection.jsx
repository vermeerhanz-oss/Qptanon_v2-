import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Loader2, Lock } from 'lucide-react';

export default function ProfileCompensationSection({ employee, canEdit, canViewSensitive, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});

  // Only admins/HR with sensitive field permission can view and edit compensation
  const canViewCompensation = canViewSensitive === true;

  const startEditing = () => {
    setFormData({
      base_salary: employee.base_salary || '',
      salary_currency: employee.salary_currency || 'AUD',
      pay_cycle: employee.pay_cycle || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatSalary = (amount, currency) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency || 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPayCycleLabel = (cycle) => {
    const labels = {
      weekly: 'Weekly',
      fortnightly: 'Fortnightly',
      monthly: 'Monthly',
    };
    return labels[cycle] || cycle || '—';
  };

  if (!canViewCompensation) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-gray-400">
            <Lock className="h-5 w-5" />
            <p>Compensation information is restricted to HR and administrators.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Compensation</h2>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Base Salary */}
          <div>
            <Label className="text-xs text-gray-500">Base Salary</Label>
            {isEditing ? (
              <Input
                type="number"
                value={formData.base_salary}
                onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || '' })}
                className="mt-1"
                placeholder="0"
              />
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatSalary(employee.base_salary, employee.salary_currency)}
              </p>
            )}
          </div>

          {/* Currency */}
          <div>
            <Label className="text-xs text-gray-500">Currency</Label>
            {isEditing ? (
              <Select 
                value={formData.salary_currency} 
                onValueChange={(v) => setFormData({ ...formData, salary_currency: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                  <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">{employee.salary_currency || 'AUD'}</p>
            )}
          </div>

          {/* Pay Cycle */}
          <div>
            <Label className="text-xs text-gray-500">Pay Cycle</Label>
            {isEditing ? (
              <Select 
                value={formData.pay_cycle} 
                onValueChange={(v) => setFormData({ ...formData, pay_cycle: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select pay cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">{getPayCycleLabel(employee.pay_cycle)}</p>
            )}
          </div>
        </div>

        {/* Variable Compensation */}
        {employee.variable_comp && Object.keys(employee.variable_comp).length > 0 && (
          <>
            <hr className="my-6" />
            <h3 className="font-medium text-gray-900 mb-4">Variable Compensation</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(employee.variable_comp, null, 2)}
              </pre>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}