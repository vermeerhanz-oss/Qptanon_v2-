import Layout from "./Layout.jsx";

import Employees from "./Employees";

import EmployeeProfile from "./EmployeeProfile";

import MyLeave from "./MyLeave";

import LeaveApprovals from "./LeaveApprovals";

import Dashboard from "./Dashboard";

import Policies from "./Policies";

import Departments from "./Departments";

import Locations from "./Locations";

import OnboardingTemplates from "./OnboardingTemplates";

import OnboardingTemplateDetail from "./OnboardingTemplateDetail";

import Offboarding from "./Offboarding";

import OrgChart from "./OrgChart";

import Onboarding from "./Onboarding";

import MyOnboarding from "./MyOnboarding";

import Setup from "./Setup";

import Home from "./Home";

import ForgotPassword from "./ForgotPassword";

import ResetPassword from "./ResetPassword";

import OnboardingDashboard from "./OnboardingDashboard";

import OnboardingDetail from "./OnboardingDetail";

import OnboardingTemplatesSettings from "./OnboardingTemplatesSettings";

import Entities from "./Entities";

import AssistantPlayground from "./AssistantPlayground";

import Settings from "./Settings";

import LeavePolicies from "./LeavePolicies";

import EmploymentAgreements from "./EmploymentAgreements";

import PublicHolidays from "./PublicHolidays";

import StaffingRules from "./StaffingRules";

import LeaveCalendar from "./LeaveCalendar";

import ReportingOverview from "./ReportingOverview";

import PeopleSummary from "./PeopleSummary";

import LeaveSummary from "./LeaveSummary";

import Demographics from "./Demographics";

import CustomReports from "./CustomReports";

import CompanySettings from "./CompanySettings";

import EmploymentPolicies from "./EmploymentPolicies";

import NewOnboarding from "./NewOnboarding";

import OnboardingManage from "./OnboardingManage";

import OffboardingManage from "./OffboardingManage";

import PolicyLibrary from "./PolicyLibrary";

import PolicyDetail from "./PolicyDetail";

import PolicyAcknowledgementsReport from "./PolicyAcknowledgementsReport";

import DocumentTemplates from "./DocumentTemplates";

import AuditLog from "./AuditLog";

import GoogleWorkspaceSettings from "./GoogleWorkspaceSettings";

import LeaveSummaryReport from "./LeaveSummaryReport";

import TeamLeave from "./TeamLeave";

import NewHireOnboardingWizard from "./NewHireOnboardingWizard";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Employees: Employees,
    
    EmployeeProfile: EmployeeProfile,
    
    MyLeave: MyLeave,
    
    LeaveApprovals: LeaveApprovals,
    
    Dashboard: Dashboard,
    
    Policies: Policies,
    
    Departments: Departments,
    
    Locations: Locations,
    
    OnboardingTemplates: OnboardingTemplates,
    
    OnboardingTemplateDetail: OnboardingTemplateDetail,
    
    Offboarding: Offboarding,
    
    OrgChart: OrgChart,
    
    Onboarding: Onboarding,
    
    MyOnboarding: MyOnboarding,
    
    Setup: Setup,
    
    Home: Home,
    
    ForgotPassword: ForgotPassword,
    
    ResetPassword: ResetPassword,
    
    OnboardingDashboard: OnboardingDashboard,
    
    OnboardingDetail: OnboardingDetail,
    
    OnboardingTemplatesSettings: OnboardingTemplatesSettings,
    
    Entities: Entities,
    
    AssistantPlayground: AssistantPlayground,
    
    Settings: Settings,
    
    LeavePolicies: LeavePolicies,
    
    EmploymentAgreements: EmploymentAgreements,
    
    PublicHolidays: PublicHolidays,
    
    StaffingRules: StaffingRules,
    
    LeaveCalendar: LeaveCalendar,
    
    ReportingOverview: ReportingOverview,
    
    PeopleSummary: PeopleSummary,
    
    LeaveSummary: LeaveSummary,
    
    Demographics: Demographics,
    
    CustomReports: CustomReports,
    
    CompanySettings: CompanySettings,
    
    EmploymentPolicies: EmploymentPolicies,
    
    NewOnboarding: NewOnboarding,
    
    OnboardingManage: OnboardingManage,
    
    OffboardingManage: OffboardingManage,
    
    PolicyLibrary: PolicyLibrary,
    
    PolicyDetail: PolicyDetail,
    
    PolicyAcknowledgementsReport: PolicyAcknowledgementsReport,
    
    DocumentTemplates: DocumentTemplates,
    
    AuditLog: AuditLog,
    
    GoogleWorkspaceSettings: GoogleWorkspaceSettings,
    
    LeaveSummaryReport: LeaveSummaryReport,
    
    TeamLeave: TeamLeave,
    
    NewHireOnboardingWizard: NewHireOnboardingWizard,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Employees />} />
                
                
                <Route path="/Employees" element={<Employees />} />
                
                <Route path="/EmployeeProfile" element={<EmployeeProfile />} />
                
                <Route path="/MyLeave" element={<MyLeave />} />
                
                <Route path="/LeaveApprovals" element={<LeaveApprovals />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Policies" element={<Policies />} />
                
                <Route path="/Departments" element={<Departments />} />
                
                <Route path="/Locations" element={<Locations />} />
                
                <Route path="/OnboardingTemplates" element={<OnboardingTemplates />} />
                
                <Route path="/OnboardingTemplateDetail" element={<OnboardingTemplateDetail />} />
                
                <Route path="/Offboarding" element={<Offboarding />} />
                
                <Route path="/OrgChart" element={<OrgChart />} />
                
                <Route path="/Onboarding" element={<Onboarding />} />
                
                <Route path="/MyOnboarding" element={<MyOnboarding />} />
                
                <Route path="/Setup" element={<Setup />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/ForgotPassword" element={<ForgotPassword />} />
                
                <Route path="/ResetPassword" element={<ResetPassword />} />
                
                <Route path="/OnboardingDashboard" element={<OnboardingDashboard />} />
                
                <Route path="/OnboardingDetail" element={<OnboardingDetail />} />
                
                <Route path="/OnboardingTemplatesSettings" element={<OnboardingTemplatesSettings />} />
                
                <Route path="/Entities" element={<Entities />} />
                
                <Route path="/AssistantPlayground" element={<AssistantPlayground />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/LeavePolicies" element={<LeavePolicies />} />
                
                <Route path="/EmploymentAgreements" element={<EmploymentAgreements />} />
                
                <Route path="/PublicHolidays" element={<PublicHolidays />} />
                
                <Route path="/StaffingRules" element={<StaffingRules />} />
                
                <Route path="/LeaveCalendar" element={<LeaveCalendar />} />
                
                <Route path="/ReportingOverview" element={<ReportingOverview />} />
                
                <Route path="/PeopleSummary" element={<PeopleSummary />} />
                
                <Route path="/LeaveSummary" element={<LeaveSummary />} />
                
                <Route path="/Demographics" element={<Demographics />} />
                
                <Route path="/CustomReports" element={<CustomReports />} />
                
                <Route path="/CompanySettings" element={<CompanySettings />} />
                
                <Route path="/EmploymentPolicies" element={<EmploymentPolicies />} />
                
                <Route path="/NewOnboarding" element={<NewOnboarding />} />
                
                <Route path="/OnboardingManage" element={<OnboardingManage />} />
                
                <Route path="/OffboardingManage" element={<OffboardingManage />} />
                
                <Route path="/PolicyLibrary" element={<PolicyLibrary />} />
                
                <Route path="/PolicyDetail" element={<PolicyDetail />} />
                
                <Route path="/PolicyAcknowledgementsReport" element={<PolicyAcknowledgementsReport />} />
                
                <Route path="/DocumentTemplates" element={<DocumentTemplates />} />
                
                <Route path="/AuditLog" element={<AuditLog />} />
                
                <Route path="/GoogleWorkspaceSettings" element={<GoogleWorkspaceSettings />} />
                
                <Route path="/LeaveSummaryReport" element={<LeaveSummaryReport />} />
                
                <Route path="/TeamLeave" element={<TeamLeave />} />
                
                <Route path="/NewHireOnboardingWizard" element={<NewHireOnboardingWizard />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}