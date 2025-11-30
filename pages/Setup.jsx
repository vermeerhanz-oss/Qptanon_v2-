import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, Building2, MapPin, User, ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { runAUStarterPack } from '@/components/setup/auStarterPack';

const Company = base44.entities.Company;
const Location = base44.entities.Location;
const Employee = base44.entities.Employee;
const Department = base44.entities.Department;

const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
];

const PAY_CYCLES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function Setup() {
  const [user, setUser] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skipToProfile, setSkipToProfile] = useState(false);
  
  // Created records
  const [createdCompanyId, setCreatedCompanyId] = useState(null);
  const [createdLocationId, setCreatedLocationId] = useState(null);
  
  // Form data
  const [companyData, setCompanyData] = useState({
    name: '',
    trading_name: '',
    abn: '',
    acn: '',
    industry: '',
    email_domain: '',
    address_line1: '',
    address_line2: '',
    suburb: '',
    state: '',
    postcode: '',
    country: 'Australia',
    default_timezone: 'Australia/Sydney',
    default_pay_cycle: '',
  });

  const [locationData, setLocationData] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    suburb: '',
    state: '',
    postcode: '',
    country: 'Australia',
    timezone: 'Australia/Sydney',
  });

  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    job_title: '',
  });

  const [enableStarterPack, setEnableStarterPack] = useState(true);
  const [starterPackResults, setStarterPackResults] = useState(null);

  useEffect(() => {
    checkSetupState();
  }, []);

  const checkSetupState = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Pre-fill email
      setProfileData(prev => ({ ...prev, email: currentUser.email }));

      // Check if company exists
      const companies = await Company.list();
      if (companies.length > 0) {
        // Company exists - check if user has employee (by user_id or email)
        setCreatedCompanyId(companies[0].id);
        
        let employees = await Employee.filter({ user_id: currentUser.id });
        if (employees.length === 0) {
          employees = await Employee.filter({ email: currentUser.email });
        }
        
        if (employees.length > 0) {
          // User already set up - redirect to dashboard
          window.location.href = createPageUrl('Dashboard');
          return;
        }
        
        // Company exists but user needs profile
        const locations = await Location.filter({ is_default: true });
        if (locations.length > 0) {
          setCreatedLocationId(locations[0].id);
        }
        setSkipToProfile(true);
        setCurrentStep(3);
      }
    } catch (error) {
      console.error('Error checking setup state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySubmit = async () => {
    if (!companyData.name || !companyData.abn) return;
    
    setIsSubmitting(true);
    try {
      const company = await Company.create(companyData);
      setCreatedCompanyId(company.id);
      
      // Pre-fill location with company address
      setLocationData(prev => ({
        ...prev,
        address_line1: companyData.address_line1,
        address_line2: companyData.address_line2,
        suburb: companyData.suburb,
        state: companyData.state,
        postcode: companyData.postcode,
        country: companyData.country,
        timezone: companyData.default_timezone,
      }));
      
      setCurrentStep(2);
    } catch (error) {
      console.error('Error creating company:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationSubmit = async () => {
    if (!locationData.name) return;
    
    setIsSubmitting(true);
    try {
      const location = await Location.create({
        ...locationData,
        company_id: createdCompanyId,
        is_default: true,
      });
      setCreatedLocationId(location.id);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error creating location:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async () => {
    if (!profileData.first_name || !profileData.last_name || !profileData.email || !profileData.job_title) return;
    
    setIsSubmitting(true);
    try {
      // Get company ID (use existing or created)
      let companyId = createdCompanyId;
      if (!companyId) {
        const companies = await Company.list();
        if (companies.length > 0) {
          companyId = companies[0].id;
        }
      }

      // Get location ID (use existing or created)
      let locationId = createdLocationId;
      if (!locationId) {
        const locations = await Location.filter({ is_default: true });
        if (locations.length > 0) {
          locationId = locations[0].id;
        }
      }

      // Create or get default department
      let departments = await Department.list();
      let departmentId;
      
      if (departments.length === 0) {
        const dept = await Department.create({ name: 'Executive', code: 'EXEC' });
        departmentId = dept.id;
      } else {
        departmentId = departments[0].id;
      }

      // Check if employee already exists for this user
      const existingEmployees = await Employee.filter({ user_id: user.id });
      
      if (existingEmployees.length > 0) {
        // Update existing employee
        await Employee.update(existingEmployees[0].id, {
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          job_title: profileData.job_title,
          company_id: companyId,
          location_id: locationId,
          department_id: departmentId,
          status: 'active',
        });
      } else {
        // Create new employee
        await Employee.create({
          user_id: user.id,
          company_id: companyId,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          job_title: profileData.job_title,
          department_id: departmentId,
          location_id: locationId,
          status: 'active',
          start_date: new Date().toISOString().split('T')[0],
        });
      }

      // Run AU Starter Pack if enabled and country is Australia (only for fresh setup, not skip mode)
      if (!skipToProfile && enableStarterPack && companyData.country === 'Australia') {
        const results = await runAUStarterPack(companyId, locationId, locationData.state);
        // Store in sessionStorage so Dashboard can show it
        sessionStorage.setItem('starterPackEnabled', 'true');
        sessionStorage.setItem('starterPackResults', JSON.stringify(results));
      }

      // Redirect to dashboard
      window.location.href = createPageUrl('Dashboard');
    } catch (error) {
      console.error('Error creating profile:', error);
      setIsSubmitting(false);
    }
  };

  const steps = skipToProfile 
    ? [{ id: 3, label: 'Your Profile', icon: User }]
    : [
        { id: 1, label: 'Company', icon: Building2 },
        { id: 2, label: 'Location', icon: MapPin },
        { id: 3, label: 'Your Profile', icon: User },
      ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to SimplePeople</h1>
          <p className="text-gray-600 mt-2">
            {skipToProfile 
              ? "Let's set up your profile to get started"
              : "Let's set up your company to get started"
            }
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isComplete = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isComplete ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-blue-600 text-white' : ''}
                    ${!isComplete && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
                  `}>
                    {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-sm mt-2 ${isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mt-5 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Form Card */}
        <Card className="shadow-xl">
          <CardContent className="p-8">
            {/* Step 1: Company Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Company Details</h2>
                  <p className="text-gray-500 text-sm mt-1">Tell us about your business</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      placeholder="Acme Pty Ltd"
                    />
                  </div>

                  <div>
                    <Label htmlFor="trading_name">Trading Name</Label>
                    <Input
                      id="trading_name"
                      value={companyData.trading_name}
                      onChange={(e) => setCompanyData({ ...companyData, trading_name: e.target.value })}
                      placeholder="Acme"
                    />
                  </div>

                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={companyData.industry}
                      onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                      placeholder="Technology"
                    />
                  </div>

                  <div>
                    <Label htmlFor="abn">ABN *</Label>
                    <Input
                      id="abn"
                      value={companyData.abn}
                      onChange={(e) => setCompanyData({ ...companyData, abn: e.target.value })}
                      placeholder="12 345 678 901"
                    />
                  </div>

                  <div>
                    <Label htmlFor="acn">ACN</Label>
                    <Input
                      id="acn"
                      value={companyData.acn}
                      onChange={(e) => setCompanyData({ ...companyData, acn: e.target.value })}
                      placeholder="123 456 789"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="email_domain">Email Domain</Label>
                    <Input
                      id="email_domain"
                      value={companyData.email_domain}
                      onChange={(e) => setCompanyData({ ...companyData, email_domain: e.target.value })}
                      placeholder="acme.com.au"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={companyData.address_line1}
                      onChange={(e) => setCompanyData({ ...companyData, address_line1: e.target.value })}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="address_line2">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={companyData.address_line2}
                      onChange={(e) => setCompanyData({ ...companyData, address_line2: e.target.value })}
                      placeholder="Suite 100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="suburb">Suburb</Label>
                    <Input
                      id="suburb"
                      value={companyData.suburb}
                      onChange={(e) => setCompanyData({ ...companyData, suburb: e.target.value })}
                      placeholder="Sydney"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select 
                      value={companyData.state} 
                      onValueChange={(v) => setCompanyData({ ...companyData, state: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={companyData.postcode}
                      onChange={(e) => setCompanyData({ ...companyData, postcode: e.target.value })}
                      placeholder="2000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="default_timezone">Default Timezone</Label>
                    <Select 
                      value={companyData.default_timezone} 
                      onValueChange={(v) => setCompanyData({ ...companyData, default_timezone: v })}
                    >
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

                  <div>
                    <Label htmlFor="default_pay_cycle">Default Pay Cycle</Label>
                    <Select 
                      value={companyData.default_pay_cycle} 
                      onValueChange={(v) => setCompanyData({ ...companyData, default_pay_cycle: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pay cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAY_CYCLES.map(pc => (
                          <SelectItem key={pc.value} value={pc.value}>{pc.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* AU Starter Pack Toggle */}
                {companyData.country === 'Australia' && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">Australian Starter Pack</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Pre-configure standard Australian leave types, public holidays, workplace policies, and onboarding tasks.
                            </p>
                          </div>
                          <Switch
                            checked={enableStarterPack}
                            onCheckedChange={setEnableStarterPack}
                          />
                        </div>
                        {enableStarterPack && (
                          <ul className="mt-3 text-sm text-gray-600 space-y-1">
                            <li>✓ Annual, Personal, Compassionate, LSL & other leave types</li>
                            <li>✓ National & state public holidays</li>
                            <li>✓ Code of Conduct, WHS, EEO, IT policies</li>
                            <li>✓ TFN, Super, Fair Work onboarding tasks</li>
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleCompanySubmit} 
                    disabled={!companyData.name || !companyData.abn || isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Next: Location
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Primary Location</h2>
                  <p className="text-gray-500 text-sm mt-1">Set up your main office or workplace</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="loc_name">Location Name *</Label>
                    <Input
                      id="loc_name"
                      value={locationData.name}
                      onChange={(e) => setLocationData({ ...locationData, name: e.target.value })}
                      placeholder="Sydney HQ"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="loc_address1">Address Line 1</Label>
                    <Input
                      id="loc_address1"
                      value={locationData.address_line1}
                      onChange={(e) => setLocationData({ ...locationData, address_line1: e.target.value })}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="loc_address2">Address Line 2</Label>
                    <Input
                      id="loc_address2"
                      value={locationData.address_line2}
                      onChange={(e) => setLocationData({ ...locationData, address_line2: e.target.value })}
                      placeholder="Suite 100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="loc_suburb">Suburb</Label>
                    <Input
                      id="loc_suburb"
                      value={locationData.suburb}
                      onChange={(e) => setLocationData({ ...locationData, suburb: e.target.value })}
                      placeholder="Sydney"
                    />
                  </div>

                  <div>
                    <Label htmlFor="loc_state">State</Label>
                    <Select 
                      value={locationData.state} 
                      onValueChange={(v) => setLocationData({ ...locationData, state: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="loc_postcode">Postcode</Label>
                    <Input
                      id="loc_postcode"
                      value={locationData.postcode}
                      onChange={(e) => setLocationData({ ...locationData, postcode: e.target.value })}
                      placeholder="2000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="loc_timezone">Timezone</Label>
                    <Select 
                      value={locationData.timezone} 
                      onValueChange={(v) => setLocationData({ ...locationData, timezone: v })}
                    >
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
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleLocationSubmit} 
                    disabled={!locationData.name || isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Next: Your Profile
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Profile */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Your Profile</h2>
                  <p className="text-gray-500 text-sm mt-1">Set up your employee profile</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                      placeholder="Smith"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="email">Work Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="job_title">Job Title *</Label>
                    <Input
                      id="job_title"
                      value={profileData.job_title}
                      onChange={(e) => setProfileData({ ...profileData, job_title: e.target.value })}
                      placeholder="HR Manager"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  {!skipToProfile && (
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                  <Button 
                    onClick={handleProfileSubmit} 
                    disabled={!profileData.first_name || !profileData.last_name || !profileData.email || !profileData.job_title || isSubmitting}
                    className={skipToProfile ? 'ml-auto' : ''}
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Complete Setup
                    <Check className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-gray-500 text-sm mt-6">
          Step {skipToProfile ? 1 : currentStep} of {skipToProfile ? 1 : 3}
        </p>
      </div>
    </div>
  );
}