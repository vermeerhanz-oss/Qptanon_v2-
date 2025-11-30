import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, TrendingUp, FileSignature, Send } from 'lucide-react';

const PAY_TYPES = [
  { value: 'salary', label: 'Annual Salary' },
  { value: 'hourly', label: 'Hourly Rate' },
];

const PAY_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

const CURRENCIES = [
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'NZD', label: 'NZD ($)' },
];

export default function StepCompensation({
  data,
  onChange,
  errors = {},
  contractTemplates = [],
}) {
  const compensation = data.compensation || {};
  const contract = data.contract || {};
  const personal = data.personal || {};

  const updateCompensation = (field, value) => {
    onChange({
      ...data,
      compensation: { ...compensation, [field]: value },
    });
  };

  const updateContract = (field, value) => {
    onChange({
      ...data,
      contract: { ...contract, [field]: value },
    });
  };

  const formatCurrency = (amount, currency = 'AUD') => {
    if (!amount) return '';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Base Pay */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Base Pay</CardTitle>
          </div>
          <CardDescription>Salary or hourly rate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Pay Type *</Label>
              <Select
                value={compensation.pay_type || ''}
                onValueChange={(v) => updateCompensation('pay_type', v)}
              >
                <SelectTrigger className={errors.pay_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select pay type" />
                </SelectTrigger>
                <SelectContent>
                  {PAY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pay_type && (
                <p className="text-sm text-red-500 mt-1">{errors.pay_type}</p>
              )}
            </div>
            <div>
              <Label htmlFor="base_amount">
                {compensation.pay_type === 'hourly' ? 'Hourly Rate *' : 'Annual Base *'}
              </Label>
              <Input
                id="base_amount"
                type="number"
                min="0"
                step="0.01"
                value={compensation.base_amount || ''}
                onChange={(e) => updateCompensation('base_amount', parseFloat(e.target.value) || 0)}
                placeholder={compensation.pay_type === 'hourly' ? '45.00' : '120000'}
                className={errors.base_amount ? 'border-red-500' : ''}
              />
              {errors.base_amount && (
                <p className="text-sm text-red-500 mt-1">{errors.base_amount}</p>
              )}
            </div>
            <div>
              <Label>Currency</Label>
              <Select
                value={compensation.currency || 'AUD'}
                onValueChange={(v) => updateCompensation('currency', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Pay Frequency</Label>
            <Select
              value={compensation.pay_frequency || 'monthly'}
              onValueChange={(v) => updateCompensation('pay_frequency', v)}
            >
              <SelectTrigger className="w-full md:w-1/3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAY_FREQUENCIES.map((freq) => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {compensation.base_amount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Base compensation: </span>
                {compensation.pay_type === 'hourly' ? (
                  <>
                    {formatCurrency(compensation.base_amount, compensation.currency)}/hour
                    {data.employment?.hours_per_week && (
                      <span className="text-gray-500">
                        {' '}
                        (~{formatCurrency(compensation.base_amount * data.employment.hours_per_week * 52, compensation.currency)}/year)
                      </span>
                    )}
                  </>
                ) : (
                  <>{formatCurrency(compensation.base_amount, compensation.currency)}/year</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variable Compensation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Variable Compensation</CardTitle>
          </div>
          <CardDescription>Commission and bonus plans (optional)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Commission */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Commission Plan</Label>
                <p className="text-sm text-gray-500">Does this role have a commission component?</p>
              </div>
              <Switch
                checked={compensation.has_commission || false}
                onCheckedChange={(checked) => updateCompensation('has_commission', checked)}
              />
            </div>
            {compensation.has_commission && (
              <div className="pl-4 border-l-2 border-indigo-100 space-y-3">
                <div>
                  <Label htmlFor="commission_target">OTE Commission Target</Label>
                  <Input
                    id="commission_target"
                    type="number"
                    min="0"
                    value={compensation.commission_target || ''}
                    onChange={(e) => updateCompensation('commission_target', parseFloat(e.target.value) || 0)}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <Label htmlFor="commission_notes">Commission Notes</Label>
                  <Textarea
                    id="commission_notes"
                    value={compensation.commission_notes || ''}
                    onChange={(e) => updateCompensation('commission_notes', e.target.value)}
                    placeholder="e.g. 10% of sales revenue, quarterly payouts..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Annual Bonus */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Annual Bonus</Label>
                <p className="text-sm text-gray-500">Does this role have a discretionary bonus?</p>
              </div>
              <Switch
                checked={compensation.has_annual_bonus || false}
                onCheckedChange={(checked) => updateCompensation('has_annual_bonus', checked)}
              />
            </div>
            {compensation.has_annual_bonus && (
              <div className="pl-4 border-l-2 border-indigo-100 space-y-3">
                <div>
                  <Label htmlFor="bonus_target_amount">Bonus Target Amount</Label>
                  <Input
                    id="bonus_target_amount"
                    type="number"
                    min="0"
                    value={compensation.bonus_target_amount || ''}
                    onChange={(e) => updateCompensation('bonus_target_amount', parseFloat(e.target.value) || 0)}
                    placeholder="10000"
                  />
                </div>
                <div>
                  <Label htmlFor="bonus_notes">Bonus Notes</Label>
                  <Textarea
                    id="bonus_notes"
                    value={compensation.bonus_notes || ''}
                    onChange={(e) => updateCompensation('bonus_notes', e.target.value)}
                    placeholder="e.g. Based on company and individual performance..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contract */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg">Employment Contract</CardTitle>
          </div>
          <CardDescription>Contract template and delivery options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contractTemplates.length > 0 && (
            <div>
              <Label>Contract Template</Label>
              <Select
                value={contract.template_id || 'none'}
                onValueChange={(v) => updateContract('template_id', v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contract template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template (manual contract)</SelectItem>
                  {contractTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-gray-400" />
              <div>
                <Label className="text-base">Send contract automatically</Label>
                <p className="text-sm text-gray-500">
                  Email contract to {personal.personal_email || 'new hire'} when wizard completes
                </p>
              </div>
            </div>
            <Switch
              checked={contract.send_automatically || false}
              onCheckedChange={(checked) => updateContract('send_automatically', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}