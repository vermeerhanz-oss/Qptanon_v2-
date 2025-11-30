import React from 'react';
import { Shield, User } from 'lucide-react';

/**
 * Banner indicating the current leave management mode
 */
export default function LeaveModeIndicator({ isAdminMode, className = '' }) {
  if (isAdminMode) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm ${className}`}>
        <Shield className="h-4 w-4 text-indigo-600" />
        <span className="text-indigo-700">
          <span className="font-medium">Mode: Admin</span> – you can manage leave for your team.
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm ${className}`}>
      <User className="h-4 w-4 text-amber-600" />
      <span className="text-amber-700">
        <span className="font-medium">Mode: Staff</span> – you can only manage your own leave.
      </span>
    </div>
  );
}