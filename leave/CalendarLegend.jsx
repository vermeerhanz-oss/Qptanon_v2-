import React from 'react';

/**
 * Calendar Legend component showing color meanings
 */
export default function CalendarLegend({ showHalfDay = true }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-green-500" />
        <span className="text-gray-600">Approved</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500" />
        <span className="text-gray-600">Pending</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded bg-red-50 relative">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </div>
        <span className="text-gray-600">Public holiday</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded ring-2 ring-indigo-500 ring-offset-1 bg-white" />
        <span className="text-gray-600">Today</span>
      </div>
      {showHalfDay && (
        <>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded overflow-hidden flex">
              <div className="w-1/2 bg-green-500" />
              <div className="w-1/2 bg-gray-100" />
            </div>
            <span className="text-gray-600">Half day (AM)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded overflow-hidden flex">
              <div className="w-1/2 bg-gray-100" />
              <div className="w-1/2 bg-green-500" />
            </div>
            <span className="text-gray-600">Half day (PM)</span>
          </div>
        </>
      )}
    </div>
  );
}