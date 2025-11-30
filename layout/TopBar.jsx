import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Menu, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Logo from '@/components/brand/Logo';
import { getDisplayName, getInitials } from '@/components/utils/displayName';
import NotificationBell from '@/components/notifications/NotificationBell';

export function TopBar({ user, employee, onMenuToggle, actingMode = 'admin' }) {
  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch (e) {}
    window.location.replace('/login');
  };

  const displayName = employee 
    ? getDisplayName(employee)
    : user?.full_name || user?.email;

  const initials = employee
    ? getInitials(employee)
    : user?.full_name?.[0] || user?.email?.[0] || '?';

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sticky top-0 z-20">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 -ml-2 mr-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to={createPageUrl('Home')} className="lg:hidden">
        <Logo size="sm" />
      </Link>

      <div className="flex-1" />

      <NotificationBell userId={user?.id} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <div className="h-9 w-9 rounded-full bg-[#0D1117] text-[#F5F5F0] flex items-center justify-center text-sm font-medium">
              {initials.toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <span
              className={
                actingMode === 'admin'
                  ? 'hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800'
                  : 'hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600'
              }
            >
              {actingMode === 'admin' ? 'Admin' : 'Staff'}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2 sm:hidden">
            <p className="text-sm font-medium text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <DropdownMenuSeparator className="sm:hidden" />
          {employee && (
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('EmployeeProfile') + `?id=${employee.id}`} className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                My Profile
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to={createPageUrl('Settings')} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}