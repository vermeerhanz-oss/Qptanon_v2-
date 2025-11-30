import React from 'react';
import { Users, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function OffboardingStats({ stats }) {
  const cards = [
    {
      label: 'Active Offboardings',
      value: stats.active,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Completed This Month',
      value: stats.completedThisMonth,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Cancelled This Month',
      value: stats.cancelledThisMonth,
      icon: XCircle,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
    },
    {
      label: 'Avg. Completion Time',
      value: stats.avgCompletionDays !== null ? `${stats.avgCompletionDays} days` : '—',
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}