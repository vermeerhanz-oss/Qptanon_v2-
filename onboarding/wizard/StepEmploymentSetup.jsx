import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Clock, FileText } from 'lucide-react';
import { calculateFTE, calculateHoursFromFTE } from '@/components/utils/newHireOnboardingHelpers';

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'casual', label: 'Casual' },
  { value: 'contractor', label: 'Contractor' },
];

const EMPLOYMENT_BASIS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'fixed_term', label: 'Fixed Term' },
  { value: 'casual', label: 'Casual' },
  { value: 'contract', label: 'Contract' },
];

const STANDARD_FULL_TIME_HOURS = 38;

export default function StepEmploymentSetup({
  data,
  onChange,
  errors = {},
  entities = [],
  agreements = [],
}) {
  const employment = data.employment || {};

  const updateEmployment = (field, value) => {
    const updated = { ...employment, [field]: value };

    // Auto-calculate FTE when hours change
    if (field === 'hours_per_week') {
      updated.fte = calculateFTE(value, STANDARD_FULL_TIME_HOURS);
    }

    // Auto-calculate hours when FTE change
    if (field === 'fte') {
      updated.hours_per_week = calculateHoursFromFTE(value, STANDARD_FULL_TIME_HOURS);
    }

    // Auto-set basis based on employment type
    if (field === 'employment_type') {
      if (value === 'casual') {
        updated.basis = 'casual';
      } else if (value === 'contractor') {
        updated.basis = 'contract';
      } else if (!updated.basis || updated.basis === 'casual' || updated.basis === 'contract') {
        updated.basis = 'permanent';
      }
    }

    onChange({
      ...data,
      employment: updated,
    });
  };

  // Set default hours for full-time if not set
  useEffect(() => {
    if (!employment.hours_per_week && employment.employment_type === 'full_time') {
      updateEmployment('hours_per_week', STANDARD_FULL_TIME_HOURS);
    }
  }, [employment.employment_type]);

  // Filter active entities and agreements
  const activeEntities = entities.filter(e => e.status === 'active');
  const activeAgreements = agreements.filter(a => a.is_active !== false);

  return (
    <div className="space-y-6">
      {/* Legal Entity */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Legal Entity</CardTitle>
          </div>
          <CardDescription>Which company entity will employ this person?</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Company Entity *</Label>
            <Select
              value={employment.entity_id || ''}
              onValueChange={(v) => updateEmployment('entity_id', v)}
            >
              <SelectTrigger className={errors.entity_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select legal entity" />
              </SelectTrigger>
              <SelectContent>
                {activeEntities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name} ({entity.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.entity_id && (
              <p className="text-sm text-red-500 mt-1">{errors.entity_id}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employment Type & Basis */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Employment Type</CardTitle>
          </div>
          <CardDescription>Type of employment and contract basis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Employment Type *</Label>
              <Select
                value={employment.employment_type || ''}
                onValueChange={(v) => updateEmployment('employment_type', v)}
              >
                <SelectTrigger className={errors.employment_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employment_type && (
                <p className="text-sm text-red-500 mt-1">{errors.employment_type}</p>
              )}
            </div>
            <div>
              <Label>Employment Basis</Label>
              <Select
                value={employment.basis || ''}
                onValueChange={(v) => updateEmployment('basis', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select basis" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_BASIS.map((basis) => (
                    <SelectItem key={basis.value} value={basis.value}>
                      {basis.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Working Hours</CardTitle>
          </div>
          <CardDescription>Contracted hours per week</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hours_per_week">Hours per Week *</Label>
              <Input
                id="hours_per_week"
                type="number"
                min="0"
                max="60"
                step="0.5"
                value={employment.hours_per_week || ''}
                onChange={(e) => updateEmployment('hours_per_week', parseFloat(e.target.value) || 0)}
                placeholder="38"
                className={errors.hours_per_week ? 'border-red-500' : ''}
              />
              {errors.hours_per_week && (
                <p className="text-sm text-red-500 mt-1">{errors.hours_per_week}</p>
              )}
            </div>
            <div>
              <Label htmlFor="fte">FTE (Full-Time Equivalent)</Label>
              <Input
                id="fte"
                type="number"
                min="0"
                max="1.5"
                step="0.01"
                value={employment.fte || ''}
                onChange={(e) => updateEmployment('fte', parseFloat(e.target.value) || 0)}
                placeholder="1.0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-calculated based on {STANDARD_FULL_TIME_HOURS}h full-time week
              </p>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Quick set:</span>
            {[
              { label: 'Full-time (38h)', hours: 38 },
              { label: '0.8 FTE (30.4h)', hours: 30.4 },
              { label: '0.6 FTE (22.8h)', hours: 22.8 },
              { label: '0.5 FTE (19h)', hours: 19 },
            ].map((preset) => (
              <button
                key={preset.hours}
                type="button"
                onClick={() => updateEmployment('hours_per_week', preset.hours)}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employment Agreement */}
      {activeAgreements.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-lg">Employment Agreement</CardTitle>
            </div>
            <CardDescription>Award or enterprise agreement (if applicable)</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Agreement / Award</Label>
              <Select
                value={employment.employment_agreement_id || 'none'}
                onValueChange={(v) => updateEmployment('employment_agreement_id', v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agreement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not applicable</SelectItem>
                  {activeAgreements.map((agreement) => (
                    <SelectItem key={agreement.id} value={agreement.id}>
                      {agreement.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}