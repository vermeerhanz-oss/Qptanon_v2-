import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  User, Globe, Bell, Palette, Shield, Users,
  Loader2, Save, Check, UserPlus, UserX, KeyRound, Mail
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isAdmin } from '@/components/utils/permissions';
import { cn } from "@/lib/utils";
import { TIMEZONES, LANGUAGES, DATE_FORMATS } from '@/components/utils/dateFormatting';
import { getDisplayName } from '@/components/utils/displayName';
import { getEmployeeForUser } from '@/components/utils/setupHelpers';

const UserPreferences = base44.entities.UserPreferences;
const NotificationPreference = base44.entities.NotificationPreference;
const Employee = base44.entities.Employee;

export default function Settings() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [notificationPrefs, setNotificationPrefs] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Load employee record for current user
      const emp = await getEmployeeForUser(currentUser);
      setEmployee(emp);

      // Load user preferences
      const allPrefs = await UserPreferences.filter({ user_id: currentUser.id });
      if (allPrefs.length > 0) {
        setPreferences(allPrefs[0]);
      } else {
        setPreferences({
          language: 'en-AU',
          date_format: 'DD/MM/YYYY',
          timezone: 'Australia/Sydney'
        });
      }

      // Load notification preferences
      const notifPrefs = await NotificationPreference.filter({ user_id: currentUser.id });
      if (notifPrefs.length > 0) {
        setNotificationPrefs(notifPrefs[0]);
      } else {
        setNotificationPrefs({
          leave_updates: true,
          approvals: true,
          onboarding: true,
          offboarding: true,
          policies: true,
          system_messages: true,
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotificationPrefs = async (updates) => {
    setIsSaving(true);
    try {
      const newPrefs = { ...notificationPrefs, ...updates };
      if (notificationPrefs?.id) {
        await NotificationPreference.update(notificationPrefs.id, updates);
      } else {
        const created = await NotificationPreference.create({ user_id: user.id, ...newPrefs });
        newPrefs.id = created.id;
      }
      setNotificationPrefs(newPrefs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const savePreferences = async (updates) => {
    setIsSaving(true);
    try {
      const newPrefs = { ...preferences, ...updates };
      if (preferences?.id) {
        await UserPreferences.update(preferences.id, updates);
      } else {
        const created = await UserPreferences.create({ user_id: user.id, ...newPrefs });
        newPrefs.id = created.id;
      }
      setPreferences(newPrefs);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const sections = [
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'regional', label: 'Language & Regional', icon: Globe },
    { id: 'notifications', label: 'Notification Preferences', icon: Bell },
    { id: 'theme', label: 'Theme & Branding', icon: Palette, adminOnly: true },
    { id: 'admin', label: 'Admin Mode', icon: Shield, adminOnly: true },
    { id: 'accounts', label: 'Account Management', icon: Users, adminOnly: true },
  ];

  const visibleSections = sections.filter(s => !s.adminOnly || isAdmin(user));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1">
                {visibleSections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      activeSection === section.id
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <section.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === 'profile' && <ProfileSection user={user} employee={employee} onEmployeeUpdate={loadData} isSaving={isSaving} saveSuccess={saveSuccess} />}
          {activeSection === 'regional' && <RegionalSection preferences={preferences} onSave={savePreferences} isSaving={isSaving} saveSuccess={saveSuccess} />}
          {activeSection === 'notifications' && <NotificationsSection preferences={notificationPrefs} onSave={saveNotificationPrefs} isSaving={isSaving} saveSuccess={saveSuccess} />}
          {activeSection === 'theme' && isAdmin(user) && <ThemeSection onSave={handleSave} isSaving={isSaving} saveSuccess={saveSuccess} />}
          {activeSection === 'admin' && isAdmin(user) && <AdminSection preferences={preferences} onSave={savePreferences} isSaving={isSaving} saveSuccess={saveSuccess} />}
          {activeSection === 'accounts' && isAdmin(user) && <AccountsSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ user, employee, onEmployeeUpdate, isSaving: parentSaving, saveSuccess: parentSuccess }) {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    preferred_name: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name || '',
        middle_name: employee.middle_name || '',
        last_name: employee.last_name || '',
        preferred_name: employee.preferred_name || '',
      });
    }
  }, [employee]);

  const handleSave = async () => {
    if (!employee) return;
    setIsSaving(true);
    try {
      await Employee.update(employee.id, {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        preferred_name: formData.preferred_name,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onEmployeeUpdate();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = employee ? getDisplayName(employee) : user?.full_name || user?.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Display Name Preview */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Your display name</p>
          <p className="text-lg font-medium text-gray-900">{displayName}</p>
          {formData.preferred_name && (
            <p className="text-xs text-gray-500 mt-1">
              Using preferred name "{formData.preferred_name}"
            </p>
          )}
        </div>

        {employee ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name <span className="text-red-500">*</span></Label>
                <Input 
                  value={formData.first_name} 
                  onChange={e => setFormData(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input 
                  value={formData.middle_name} 
                  onChange={e => setFormData(f => ({ ...f, middle_name: e.target.value }))}
                  placeholder="Middle name (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name <span className="text-red-500">*</span></Label>
                <Input 
                  value={formData.last_name} 
                  onChange={e => setFormData(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Name</Label>
                <Input 
                  value={formData.preferred_name} 
                  onChange={e => setFormData(f => ({ ...f, preferred_name: e.target.value }))}
                  placeholder="Preferred name (optional)"
                />
                <p className="text-xs text-gray-500">This name will be displayed in the app</p>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            No employee profile found. Contact your administrator to set up your profile.
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ''} disabled className="bg-gray-50" />
          <p className="text-xs text-gray-500">Contact your administrator to change your email</p>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <div>
            <Badge variant="secondary" className="capitalize">{user?.role || 'user'}</Badge>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !employee || !formData.first_name || !formData.last_name}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : saveSuccess ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saveSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RegionalSection({ preferences, onSave, isSaving, saveSuccess }) {
  const [language, setLanguage] = useState(preferences?.language || 'en-AU');
  const [timezone, setTimezone] = useState(preferences?.timezone || 'Australia/Sydney');
  const [dateFormat, setDateFormat] = useState(preferences?.date_format || 'DD/MM/YYYY');

  useEffect(() => {
    if (preferences) {
      setLanguage(preferences.language || 'en-AU');
      setTimezone(preferences.timezone || 'Australia/Sydney');
      setDateFormat(preferences.date_format || 'DD/MM/YYYY');
    }
  }, [preferences]);

  const handleSave = () => {
    onSave({
      language,
      timezone,
      date_format: dateFormat
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language & Regional Settings</CardTitle>
        <CardDescription>Customize language and regional preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
              ))}
              <SelectItem value="placeholder" disabled className="text-gray-400 italic">
                More languages coming soon...
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map(fmt => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label} <span className="text-gray-400 ml-2">({fmt.example})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : saveSuccess ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saveSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsSection({ preferences, onSave, isSaving, saveSuccess }) {
  const [prefs, setPrefs] = useState({
    leave_updates: true,
    approvals: true,
    onboarding: true,
    offboarding: true,
    policies: true,
    system_messages: true,
  });

  useEffect(() => {
    if (preferences) {
      setPrefs({
        leave_updates: preferences.leave_updates ?? true,
        approvals: preferences.approvals ?? true,
        onboarding: preferences.onboarding ?? true,
        offboarding: preferences.offboarding ?? true,
        policies: preferences.policies ?? true,
        system_messages: preferences.system_messages ?? true,
      });
    }
  }, [preferences]);

  const handleToggle = (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    onSave({ [key]: value });
  };

  const notificationCategories = [
    { key: 'leave_updates', label: 'Leave Updates', description: 'Notifications about leave requests and approvals' },
    { key: 'approvals', label: 'Manager Approvals', description: 'When you need to approve something' },
    { key: 'onboarding', label: 'Onboarding Tasks', description: 'Notifications about onboarding tasks' },
    { key: 'offboarding', label: 'Offboarding Tasks', description: 'Notifications about offboarding tasks' },
    { key: 'policies', label: 'Policy Updates', description: 'When policies are updated and require acknowledgement' },
    { key: 'system_messages', label: 'System Announcements', description: 'Important system-wide announcements' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose which notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notificationCategories.map(cat => (
          <div key={cat.key} className="flex items-center justify-between py-3 border-b last:border-0">
            <div>
              <p className="font-medium text-gray-900">{cat.label}</p>
              <p className="text-sm text-gray-500">{cat.description}</p>
            </div>
            <Switch 
              checked={prefs[cat.key]} 
              onCheckedChange={(val) => handleToggle(cat.key, val)} 
              disabled={isSaving}
            />
          </div>
        ))}

        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600 pt-2">
            <Check className="h-4 w-4" />
            Preferences saved
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ThemeSection({ onSave, isSaving, saveSuccess }) {
  const [settings, setSettings] = useState({
    logo_url: '',
    primary_color: '#6366F1',
    secondary_color: '#0D1117',
    use_branding: false,
  });
  const [settingsId, setSettingsId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const all = await base44.entities.CompanySettings.list();
    if (all.length > 0) {
      setSettings({
        logo_url: all[0].logo_url || '',
        primary_color: all[0].primary_color || '#6366F1',
        secondary_color: all[0].secondary_color || '#0D1117',
        use_branding: all[0].use_branding || false,
      });
      setSettingsId(all[0].id);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSettings(s => ({ ...s, logo_url: file_url }));
    } catch (error) {
      console.error('Error uploading logo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setLocalSaving(true);
    try {
      if (settingsId) {
        await base44.entities.CompanySettings.update(settingsId, settings);
      } else {
        const created = await base44.entities.CompanySettings.create(settings);
        setSettingsId(created.id);
      }
      setLocalSuccess(true);
      setTimeout(() => setLocalSuccess(false), 2000);
      // Reload to apply branding
      window.location.reload();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLocalSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme & Branding</CardTitle>
        <CardDescription>Customize the look and feel of your HRIS</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <div className="h-16 w-40 border rounded-lg flex items-center justify-center bg-gray-50 p-2">
                <img src={settings.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="h-16 w-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 text-gray-400">
                No logo
              </div>
            )}
            <div className="space-y-2">
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button variant="outline" size="sm" asChild disabled={isUploading}>
                  <span>{isUploading ? 'Uploading...' : 'Upload Logo'}</span>
                </Button>
              </label>
              {settings.logo_url && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSettings(s => ({ ...s, logo_url: '' }))}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">Recommended: PNG or SVG, max 200x60px</p>
        </div>

        <Separator />

        {/* Primary Color */}
        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-3">
            <input 
              type="color" 
              value={settings.primary_color} 
              onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <Input 
              value={settings.primary_color} 
              onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))} 
              className="w-32" 
            />
          </div>
          <p className="text-xs text-gray-500">Used for buttons, links, and accents</p>
        </div>

        {/* Secondary Color */}
        <div className="space-y-2">
          <Label>Secondary Color</Label>
          <div className="flex items-center gap-3">
            <input 
              type="color" 
              value={settings.secondary_color} 
              onChange={e => setSettings(s => ({ ...s, secondary_color: e.target.value }))}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <Input 
              value={settings.secondary_color} 
              onChange={e => setSettings(s => ({ ...s, secondary_color: e.target.value }))} 
              className="w-32" 
            />
          </div>
          <p className="text-xs text-gray-500">Used for sidebar and header backgrounds</p>
        </div>

        <Separator />

        {/* Toggle Branding */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
          <div>
            <p className="font-medium">Use Company Branding</p>
            <p className="text-sm text-gray-500">Apply logo and colors across the application</p>
          </div>
          <Switch 
            checked={settings.use_branding} 
            onCheckedChange={(val) => setSettings(s => ({ ...s, use_branding: val }))} 
          />
        </div>

        {settings.use_branding && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
            When enabled, your company logo will replace the default logo, and your brand colors will be applied to the header, sidebar, and buttons.
          </div>
        )}

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={localSaving}>
            {localSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : localSuccess ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {localSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSection({ preferences, onSave, isSaving, saveSuccess }) {
  const [actingMode, setActingMode] = useState(preferences?.acting_mode || 'admin');

  useEffect(() => {
    if (preferences) {
      setActingMode(preferences.acting_mode || 'admin');
    }
  }, [preferences]);

  const handleToggle = (checked) => {
    const newMode = checked ? 'admin' : 'staff';
    setActingMode(newMode);
    onSave({ acting_mode: newMode });
  };

  const isAdminMode = actingMode === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Mode</CardTitle>
        <CardDescription>Switch between administrator and staff access levels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              isAdminMode ? "bg-indigo-100" : "bg-gray-200"
            )}>
              <Shield className={cn("h-5 w-5", isAdminMode ? "text-indigo-600" : "text-gray-500")} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Act as Administrator</p>
              <p className="text-sm text-gray-500">
                {isAdminMode ? 'Full admin access enabled' : 'Restricted to personal actions only'}
              </p>
            </div>
          </div>
          <Switch 
            checked={isAdminMode} 
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>

        {/* Status Banner */}
        {isAdminMode ? (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="font-medium text-indigo-800">Administrator Mode Active</p>
                <p className="text-sm text-indigo-700 mt-1">
                  You have full administrative privileges including:
                </p>
                <ul className="text-sm text-indigo-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Approving leave on behalf of others</li>
                  <li>Submitting leave requests for staff</li>
                  <li>Managing reporting lines</li>
                  <li>Managing entities and locations</li>
                  <li>Editing other users' profiles</li>
                  <li>Viewing admin-level dashboards</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-100 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Staff Mode Active</p>
                <p className="text-sm text-gray-600 mt-1">
                  You are currently restricted to:
                </p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
                  <li>Your own personal profile</li>
                  <li>Your own leave requests</li>
                  <li>Your own settings</li>
                </ul>
                <p className="text-sm text-gray-500 mt-3 italic">
                  Toggle the switch above to re-enable admin privileges.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions (only in admin mode) */}
        {isAdminMode && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Quick Admin Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start" asChild>
                <a href="/Departments">Manage Departments</a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/Locations">Manage Locations</a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/Entities">Manage Entities</a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/OnboardingTemplates">Onboarding Templates</a>
              </Button>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Mode updated successfully
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountsSection() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'user'
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setIsLoading(true);
    const all = await base44.entities.Employee.list();
    setEmployees(all.filter(e => e.status === 'active'));
    setIsLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.first_name || !inviteForm.last_name || !inviteForm.email) return;
    
    setIsProcessing(true);
    try {
      // Create employee record
      await base44.entities.Employee.create({
        first_name: inviteForm.first_name,
        last_name: inviteForm.last_name,
        email: inviteForm.email,
        status: 'onboarding',
        start_date: new Date().toISOString().split('T')[0],
        job_title: 'New Employee'
      });

      // Send invite email
      await base44.integrations.Core.SendEmail({
        to: inviteForm.email,
        subject: 'Welcome to the Team!',
        body: `Hi ${inviteForm.first_name},\n\nYou have been invited to join our HRIS system. Please contact your administrator to set up your account access.\n\nBest regards,\nHR Team`
      });

      setSuccessMessage(`Invitation sent to ${inviteForm.email}`);
      setShowInviteDialog(false);
      setInviteForm({ first_name: '', last_name: '', email: '', role: 'user' });
      loadEmployees();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error inviting user:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedEmployee) return;
    
    setIsProcessing(true);
    try {
      await base44.entities.Employee.update(selectedEmployee.id, {
        status: 'terminated',
        termination_date: new Date().toISOString().split('T')[0]
      });

      setSuccessMessage(`${selectedEmployee.first_name} ${selectedEmployee.last_name} has been deactivated`);
      setShowDeactivateDialog(false);
      setSelectedEmployee(null);
      loadEmployees();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deactivating user:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee) return;
    
    setIsProcessing(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: selectedEmployee.email,
        subject: 'Password Reset Request',
        body: `Hi ${selectedEmployee.first_name},\n\nA password reset has been requested for your account. Please contact your administrator or use the forgot password link on the login page to reset your password.\n\nBest regards,\nHR Team`
      });

      setSuccessMessage(`Password reset email sent to ${selectedEmployee.email}`);
      setShowResetDialog(false);
      setSelectedEmployee(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error sending reset email:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
          <CardDescription>Invite, deactivate, and manage user accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <Check className="h-4 w-4" />
              {successMessage}
            </div>
          )}

          {/* Action Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Invite New Staff */}
            <div 
              onClick={() => setShowInviteDialog(true)}
              className="p-4 border rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Invite New Staff</p>
                  <p className="text-xs text-gray-500">Add a new team member</p>
                </div>
              </div>
            </div>

            {/* Deactivate User */}
            <div 
              onClick={() => setShowDeactivateDialog(true)}
              className="p-4 border rounded-lg hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Deactivate User</p>
                  <p className="text-xs text-gray-500">Revoke access</p>
                </div>
              </div>
            </div>

            {/* Reset Password */}
            <div 
              onClick={() => setShowResetDialog(true)}
              className="p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Reset Password</p>
                  <p className="text-xs text-gray-500">Send reset email</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/Employees">
                <Users className="h-4 w-4 mr-2" />
                View All Employees
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Staff Member</DialogTitle>
            <DialogDescription>
              Enter the details for the new team member. They will receive an invitation email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input 
                  value={inviteForm.first_name}
                  onChange={e => setInviteForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input 
                  value={inviteForm.last_name}
                  onChange={e => setInviteForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john.smith@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Role</Label>
              <Select value={inviteForm.role} onValueChange={val => setInviteForm(f => ({ ...f, role: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Employee</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={isProcessing || !inviteForm.first_name || !inviteForm.last_name || !inviteForm.email}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Select an employee to deactivate. This will revoke their system access.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {employees.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedEmployee?.id === emp.id 
                        ? "border-orange-400 bg-orange-50" 
                        : "hover:bg-gray-50"
                    )}
                  >
                    <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                ))}
                {employees.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No active employees found</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeactivateDialog(false); setSelectedEmployee(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={isProcessing || !selectedEmployee}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
              Deactivate User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Select an employee to send a password reset email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {employees.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedEmployee?.id === emp.id 
                        ? "border-blue-400 bg-blue-50" 
                        : "hover:bg-gray-50"
                    )}
                  >
                    <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                ))}
                {employees.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No active employees found</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetDialog(false); setSelectedEmployee(null); }}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={isProcessing || !selectedEmployee}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Send Reset Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}