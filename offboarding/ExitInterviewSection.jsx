import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Star, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const OffboardingInstance = base44.entities.OffboardingInstance;

export function ExitInterviewSection({ instance, canEdit, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    exit_interview_completed_at: instance.exit_interview_completed_at 
      ? instance.exit_interview_completed_at.split('T')[0] 
      : '',
    exit_interview_notes: instance.exit_interview_notes || '',
    exit_interview_rating: instance.exit_interview_rating || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData = {
        exit_interview_notes: formData.exit_interview_notes || null,
        exit_interview_rating: formData.exit_interview_rating ? Number(formData.exit_interview_rating) : null,
        exit_interview_completed_at: formData.exit_interview_completed_at 
          ? new Date(formData.exit_interview_completed_at).toISOString() 
          : null,
      };
      
      await OffboardingInstance.update(instance.id, updateData);
      onUpdate({ ...instance, ...updateData });
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving exit interview:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasExitInterview = instance.exit_interview_completed_at;
  const showReminder = instance.status === 'completed' && !hasExitInterview;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Exit Interview</h3>
        </div>
        {canEdit && !isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            {hasExitInterview ? 'Edit' : 'Add Notes'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {showReminder && !isEditing && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <p className="text-sm text-yellow-700">
              No exit interview recorded. Consider adding notes for future reference.
            </p>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interview Date
              </label>
              <Input
                type="date"
                value={formData.exit_interview_completed_at}
                onChange={(e) => setFormData({ ...formData, exit_interview_completed_at: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rating (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setFormData({ ...formData, exit_interview_rating: num })}
                    className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors ${
                      Number(formData.exit_interview_rating) === num
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <Textarea
                value={formData.exit_interview_notes}
                onChange={(e) => setFormData({ ...formData, exit_interview_notes: e.target.value })}
                placeholder="Key takeaways, feedback, reasons for leaving..."
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : hasExitInterview ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {instance.exit_interview_completed_at && (
                <div>
                  <p className="text-xs text-gray-500">Interview Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(instance.exit_interview_completed_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {instance.exit_interview_rating && (
                <div>
                  <p className="text-xs text-gray-500">Rating</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <Star
                        key={num}
                        className={`h-4 w-4 ${
                          num <= instance.exit_interview_rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            {instance.exit_interview_notes && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                  {instance.exit_interview_notes}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No exit interview recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}