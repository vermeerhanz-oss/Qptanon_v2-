
import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { BrandingProvider, useBranding } from '@/components/branding/BrandingProvider';
import BrandedLogo from '@/components/branding/BrandedLogo';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import AssistantLauncher from '@/components/assistant/AssistantLauncher';
import AssistantSidebar from '@/components/assistant/AssistantSidebar';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { X, Loader2 } from 'lucide-react';

const BARE_PAGES = ['Login', 'ForgotPassword', 'ResetPassword', 'Setup'];

function AppShell({ children, currentPageName }) {
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const branding = useBranding();

  useEffect(() => {
    async function loadContext() {
      try {
        const ctx = await getCurrentUserEmployeeContext();
        setContext(ctx);
      } catch (err) {
        setContext(null);
      }
      setIsLoading(false);
    }
    loadContext();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <BrandedLogo size="lg" darkBg className="mb-6" />
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  const sidebarBg = branding?.useBranding ? branding.secondaryColor : '#0D1117';

  return (
    <div className="min-h-screen bg-gray-50">
      {branding?.useBranding && (
        <style>{`:root { --brand-primary: ${branding.primaryColor}; --brand-secondary: ${branding.secondaryColor}; }`}</style>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-200 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ backgroundColor: sidebarBg }}
      >
        <div className="h-16 flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-700/50">
          <Link to={createPageUrl('Home')} onClick={() => setSidebarOpen(false)}>
            <BrandedLogo size="sm" darkBg />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar 
            currentPageName={currentPageName} 
            context={context}
            onNavigate={() => setSidebarOpen(false)} 
          />
        </div>
      </aside>

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <TopBar user={context?.user} employee={context?.employee} onMenuToggle={() => setSidebarOpen(true)} actingMode={context?.actingMode || 'admin'} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      <AssistantLauncher isOpen={assistantOpen} onClick={() => setAssistantOpen(prev => !prev)} />
      <AssistantSidebar isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  if (BARE_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <BrandingProvider>
      <AppShell currentPageName={currentPageName}>{children}</AppShell>
    </BrandingProvider>
  );
}
