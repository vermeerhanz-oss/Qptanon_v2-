import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, UserPlus, Check } from 'lucide-react';

import WizardStepper from '@/components/onboarding/wizard/WizardStepper';
import StepPersonalDetails from '@/components/onboarding/wizard/StepPersonalDetails';
import StepEmploymentSetup from '@/components/onboarding/wizard/StepEmploymentSetup';
import StepCompensation from '@/components/onboarding/wizard/StepCompensation';
import StepOnboardingPlan from '@/components/onboarding/wizard/StepOnboardingPlan';

import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { createNewHireFromWizard, validateStep } from '@/components/utils/newHireOnboardingHelpers';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;
const CompanyEntity = base44.entities.CompanyEntity;
const EmploymentAgreement = base44.entities.EmploymentAgreement;
const OnboardingTemplate = base44.entities.OnboardingTemplate;
const Policy = base44.entities.Policy;
const DocumentTemplate = base44.entities.DocumentTemplate;

const TOTAL_STEPS = 4;

export default function NewHireOnboardingWizard() {
  const navigate = useNavigate();

  // Auth & permissions
  const [userContext, setUserContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [errors, setErrors] = useState({});

  // Wizard data
  const [wizardData, setWizardData] = useState({
    personal: {},
    employment: { employment_type: 'full_time', hours_per_week: 38, fte: 1.0 },
    compensation: { pay_type: 'salary', currency: 'AUD', pay_frequency: 'monthly' },
    contract: {},
    onboarding: { policy_ids: [] },
  });

  // Reference data
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [contractTemplates, setContractTemplates] = useState([]);

  // Load reference data
  useEffect(() => {
    async function loadData() {
      try {
        const ctx = await getCurrentUserEmployeeContext();
        setUserContext(ctx);

        // Check permissions
        if (!ctx.permissions?.canManageOnboarding) {
          toast.error('You do not have permission to create new hires.');
          navigate(createPageUrl('Home'));
          return;
        }

        // Load all reference data in parallel
        const [
          empList,
          deptList,
          locList,
          entityList,
          agreementList,
          templateList,
          policyList,
          docTemplateList,
        ] = await Promise.all([
          Employee.filter({ status: 'active' }),
          Department.list(),
          Location.list(),
          CompanyEntity.filter({ status: 'active' }),
          EmploymentAgreement.filter({ is_active: true }),
          OnboardingTemplate.filter({ active: true }),
          Policy.filter({ is_active: true }),
          DocumentTemplate ? DocumentTemplate.filter({ is_active: true }).catch(() => []) : Promise.resolve([]),
        ]);

        setEmployees(empList);
        setDepartments(deptList);
        setLocations(locList);
        setEntities(entityList);
        setAgreements(agreementList);
        setTemplates(templateList);
        setPolicies(policyList);
        setContractTemplates(docTemplateList);

        // Auto-select default entity if only one
        if (entityList.length === 1) {
          setWizardData((prev) => ({
            ...prev,
            employment: { ...prev.employment, entity_id: entityList[0].id },
          }));
        }

        // Auto-select default template
        const defaultTemplate = templateList.find((t) => t.is_default);
        if (defaultTemplate) {
          setWizardData((prev) => ({
            ...prev,
            onboarding: { ...prev.onboarding, onboarding_template_id: defaultTemplate.id },
          }));
        }

        // Auto-select mandatory policies
        const mandatoryPolicies = policyList.filter((p) => p.is_mandatory);
        if (mandatoryPolicies.length > 0) {
          setWizardData((prev) => ({
            ...prev,
            onboarding: {
              ...prev.onboarding,
              policy_ids: mandatoryPolicies.map((p) => p.id),
            },
          }));
        }
      } catch (error) {
        console.error('Error loading wizard data:', error);
        toast.error('Failed to load wizard data');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [navigate]);

  const handleDataChange = (newData) => {
    setWizardData(newData);
    setErrors({});
  };

  const handleNext = () => {
    const validation = validateStep(currentStep, wizardData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('Please fix the errors before continuing');
      return;
    }

    setErrors({});
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate final step
    const validation = validateStep(currentStep, wizardData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createNewHireFromWizard(wizardData);

      if (result.success) {
        toast.success('New hire created and onboarding started!');
        navigate(createPageUrl('EmployeeProfile') + `?id=${result.employee_id}`);
      } else {
        toast.error(result.error || 'Failed to create new hire');
      }
    } catch (error) {
      console.error('Error creating new hire:', error);
      toast.error('Failed to create new hire. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-500">Loading wizard...</p>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepPersonalDetails
            data={wizardData}
            onChange={handleDataChange}
            errors={errors}
            employees={employees}
            departments={departments}
            locations={locations}
          />
        );
      case 2:
        return (
          <StepEmploymentSetup
            data={wizardData}
            onChange={handleDataChange}
            errors={errors}
            entities={entities}
            agreements={agreements}
          />
        );
      case 3:
        return (
          <StepCompensation
            data={wizardData}
            onChange={handleDataChange}
            errors={errors}
            contractTemplates={contractTemplates}
          />
        );
      case 4:
        return (
          <StepOnboardingPlan
            data={wizardData}
            onChange={handleDataChange}
            templates={templates}
            policies={policies}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Hire Onboarding</h1>
            <p className="text-gray-500">Create employee record and start onboarding</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <WizardStepper currentStep={currentStep} completedSteps={completedSteps} />

      {/* Step Content */}
      <div className="mb-8">{renderStep()}</div>

      {/* Navigation Buttons */}
      <Card>
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex gap-3">
              {currentStep < TOTAL_STEPS ? (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create Employee & Start Onboarding
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}