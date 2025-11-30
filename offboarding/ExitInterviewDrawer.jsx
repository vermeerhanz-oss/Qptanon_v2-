import React from 'react';
import { Button } from "@/components/ui/button";
import { X, Star, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';

export function ExitInterviewDrawer({ instance, employee, onClose }) {
  if (!instance) return null;

  const hasNotes = instance.exit_interview_notes;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Exit Interview</h2>
            <p className="text-sm text-gray-500">
              {employee ? `${employee.first_name} ${employee.last_name}` : 'Employee'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Interview Date */}
          {instance.exit_interview_completed_at && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Interview Date</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(instance.exit_interview_completed_at), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          )}

          {/* Rating */}
          {instance.exit_interview_rating && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall Rating</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <Star
                      key={num}
                      className={`h-5 w-5 ${
                        num <= instance.exit_interview_rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    {instance.exit_interview_rating}/5
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {hasNotes ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-700">Interview Notes</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {instance.exit_interview_notes}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No interview notes recorded</p>
            </div>
          )}

          {/* Final Day */}
          {instance.final_day && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">Final Working Day</p>
              <p className="font-medium text-gray-900">
                {format(new Date(instance.final_day), 'MMMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}