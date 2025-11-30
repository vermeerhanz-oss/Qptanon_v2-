import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronDown } from 'lucide-react';
import { getVisibleSections, findSectionByPage, findActiveNavItem } from './navConfig';
import { cn } from '@/lib/utils';
import { useBranding } from '@/components/branding/BrandingProvider';

export function Sidebar({ currentPageName, context, onNavigate }) {
  const { useBranding: useBrand, primaryColor } = useBranding();
  
  // Use context to derive visible sections
  const visibleSections = context ? getVisibleSections(context) : [];
  const activeSection = findSectionByPage(currentPageName);
  const activeNavItem = findActiveNavItem(currentPageName);
  
  const [expandedSections, setExpandedSections] = useState(() => {
    const initial = {};
    if (activeSection) {
      initial[activeSection] = true;
    }
    return initial;
  });

  useEffect(() => {
    if (activeSection && !expandedSections[activeSection]) {
      setExpandedSections(prev => ({ ...prev, [activeSection]: true }));
    }
  }, [activeSection]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  if (!context) {
    return <nav className="flex-1 overflow-y-auto py-4 px-3" />;
  }

  return (
    <nav className="overflow-y-auto h-full py-4 px-3 pr-2">
      {visibleSections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections[section.id];
        const hasActiveItem = section.items.some(item => 
          item.page === currentPageName || (item.childPages && item.childPages.includes(currentPageName))
        );

        return (
          <div key={section.id} className="mb-1">
            <button
              onClick={() => toggleSection(section.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                hasActiveItem 
                  ? "text-white bg-white/10" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span>{section.label}</span>
              </div>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isExpanded && "rotate-180"
                )} 
              />
            </button>

            {isExpanded && (
              <div className="mt-1 ml-4 pl-3 border-l border-slate-700">
                {section.items.map((item, idx) => {
                  // Render non-clickable headers
                  if (item.isHeader) {
                    return (
                      <div 
                        key={`header-${idx}`}
                        className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mt-2 first:mt-0"
                      >
                        {item.label}
                      </div>
                    );
                  }

                  // Check if this item is active (direct match or child page)
                  const isActive = activeNavItem === item.page;
                  return (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      onClick={onNavigate}
                      className={cn(
                        "block px-3 py-2 text-sm rounded-lg transition-all duration-200",
                        isActive
                          ? "font-medium"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                      style={isActive ? { 
                        color: useBrand ? primaryColor : '#818cf8',
                        backgroundColor: useBrand ? `${primaryColor}20` : 'rgba(99, 102, 241, 0.1)'
                      } : {}}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}