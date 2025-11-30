import React from 'react';
import { Clock, Check, X, Ban } from 'lucide-react';

/**
 * Unified leave status chip component
 * 
 * @param {Object} props
 * @param {'pending'|'approved'|'declined'|'cancelled'} props.status
 * @param {'sm'|'md'} props.size - Size variant (default: 'md')
 */
export default function LeaveStatusChip({ status, size = 'md' }) {
  const config = {
    pending: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: Clock,
      label: 'Pending',
    },
    approved: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: Check,
      label: 'Approved',
    },
    declined: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: X,
      label: 'Declined',
    },
    cancelled: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-500',
      icon: Ban,
      label: 'Cancelled',
    },
  };

  const { bg, border, text, icon: Icon, label } = config[status] || config.pending;

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px] gap-1' 
    : 'px-2.5 py-1 text-xs gap-1.5';
  
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${bg} ${border} ${text} ${sizeClasses}`}>
      <Icon className={iconSize} />
      {label}
    </span>
  );
}