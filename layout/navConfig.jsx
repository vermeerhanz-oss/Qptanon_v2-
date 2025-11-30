import { 
  Users, Calendar, UserPlus, UserMinus, Building2, Settings, Home, BarChart3, 
  MapPin, Network, FileText, Bell, ClipboardList, CalendarDays
} from 'lucide-react';

/**
 * Navigation Configuration
 * 
 * Visibility is controlled by two flags:
 * - adminOnly: requires admin/owner role AND admin acting mode
 * - managerOrAdmin: requires (admin/owner OR is_manager) AND admin acting mode
 * 
 * Items without these flags are visible to everyone.
 */
export const navSections = [
  {
    id: 'main',
    label: 'Main',
    icon: Home,
    items: [
      { label: 'Home', page: 'Home' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    items: [
      { label: 'Employees', page: 'Employees' },
      { label: 'Departments', page: 'Departments', managerOrAdmin: true },
      { label: 'Locations', page: 'Locations', managerOrAdmin: true },
      { label: 'Org Chart', page: 'OrgChart' },
    ],
  },
  {
    id: 'leave',
    label: 'Leave',
    icon: Calendar,
    items: [
      { label: 'My Leave', page: 'MyLeave' },
      { label: 'Team Leave', page: 'TeamLeave', managerOrAdmin: true },
      { label: 'Leave Approvals', page: 'LeaveApprovals', managerOrAdmin: true },
      { label: 'Leave Calendar', page: 'LeaveCalendar' },
      { label: 'Leave Summary', page: 'LeaveSummary', managerOrAdmin: true },
      { label: 'Leave Policies', page: 'LeavePolicies', adminOnly: true },
    ],
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: UserPlus,
    items: [
      { label: 'My Onboarding', page: 'MyOnboarding' },
      { label: 'Onboard New Hire', page: 'NewHireOnboardingWizard', managerOrAdmin: true },
      { label: 'Onboarding Management', page: 'OnboardingManage', managerOrAdmin: true, childPages: ['OnboardingDashboard', 'NewOnboarding'] },
      { label: 'Onboarding Templates', page: 'OnboardingTemplates', managerOrAdmin: true, childPages: ['OnboardingTemplatesSettings'] },
    ],
  },
  {
    id: 'offboarding',
    label: 'Offboarding',
    icon: UserMinus,
    items: [
      { label: 'Offboarding', page: 'Offboarding', managerOrAdmin: true },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    icon: BarChart3,
    items: [
      { label: 'Standard Reports', page: 'ReportingOverview', managerOrAdmin: true, childPages: ['PeopleSummary', 'Demographics', 'PolicyAcknowledgementsReport'] },
      { label: 'Leave Summary', page: 'LeaveSummaryReport', adminOnly: true },
      { label: 'Custom Reports', page: 'CustomReports', managerOrAdmin: true },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    icon: Building2,
    items: [
      { label: 'Company Details', page: 'CompanySettings', managerOrAdmin: true },
      { label: 'Entities', page: 'Entities', managerOrAdmin: true },
      { label: 'Public Holidays', page: 'PublicHolidays', managerOrAdmin: true },
      { label: 'Employment Agreements', page: 'EmploymentAgreements', managerOrAdmin: true },
      { label: 'Policies', page: 'PolicyLibrary', managerOrAdmin: true, childPages: ['PolicyDetail', 'MyPolicies'] },
      { label: 'Staffing Rules', page: 'StaffingRules', managerOrAdmin: true },
      { label: 'Document Templates', page: 'DocumentTemplates', adminOnly: true },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'My Settings', page: 'Settings' },
    ],
  },
];

/**
 * Get visible sections based on employee context
 * @param {Object} context - Employee context from getCurrentUserEmployeeContext
 */
export function getVisibleSections(context) {
  const permissions = context.permissions || {};

  return navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        // Check permission key if specified
        if (item.permissionKey) {
          return permissions[item.permissionKey] === true;
        }
        
        // Admin-only items: require canManageCompanySettings
        if (item.adminOnly) {
          return permissions.canManageCompanySettings === true;
        }
        
        // Manager or admin items: check relevant permission
        if (item.managerOrAdmin) {
          // Use specific permission based on section context
          if (section.id === 'time') return permissions.canViewTeamTimeOff === true;
          if (section.id === 'onboarding') return permissions.canManageOnboarding === true;
          if (section.id === 'offboarding') return permissions.canManageOffboarding === true;
          if (section.id === 'reporting') return permissions.canViewReports === true;
          if (section.id === 'company') return permissions.canManageCompanySettings === true;
          // Default fallback
          return permissions.canManageOnboarding === true || permissions.canViewReports === true;
        }
        
        // Default: visible to everyone
        return true;
      }),
    }))
    .filter(section => section.items.length > 0);
}

export function findSectionByPage(pageName) {
  for (const section of navSections) {
    if (section.items.some(item => item.page === pageName || (item.childPages && item.childPages.includes(pageName)))) {
      return section.id;
    }
  }
  return null;
}

/**
 * Find the active nav item for a given page name (handles child pages)
 */
export function findActiveNavItem(pageName) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.page === pageName) {
        return item.page;
      }
      if (item.childPages && item.childPages.includes(pageName)) {
        return item.page;
      }
    }
  }
  return null;
}