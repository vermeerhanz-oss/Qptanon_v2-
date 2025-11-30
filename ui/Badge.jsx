import React from 'react';

const variants = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const statusConfig = {
    active: { variant: 'success', label: 'Active' },
    onboarding: { variant: 'info', label: 'Onboarding' },
    offboarding: { variant: 'warning', label: 'Offboarding' },
    on_leave: { variant: 'warning', label: 'On Leave' },
    terminated: { variant: 'danger', label: 'Terminated' },
    pending: { variant: 'warning', label: 'Pending' },
    approved: { variant: 'success', label: 'Approved' },
    declined: { variant: 'danger', label: 'Declined' },
    cancelled: { variant: 'default', label: 'Cancelled' },
    not_started: { variant: 'default', label: 'Not Started' },
    in_progress: { variant: 'info', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    draft: { variant: 'default', label: 'Draft' },
    scheduled: { variant: 'info', label: 'Scheduled' },
  };

  const config = statusConfig[status] || { variant: 'default', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}