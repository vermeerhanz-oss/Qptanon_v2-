import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export default function CompleteOnboardingDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isProcessing,
  incompleteTasks 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Onboarding</DialogTitle>
          <DialogDescription>
            {incompleteTasks > 0 ? (
              <div className="flex items-start gap-2 mt-2 p-3 bg-yellow-50 rounded-lg text-yellow-700">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>
                  There are <strong>{incompleteTasks}</strong> required tasks that are not yet completed. 
                  Completing the onboarding will mark all remaining required tasks as complete.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-2 p-3 bg-green-50 rounded-lg text-green-700">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>All required tasks are complete. Ready to finalize onboarding.</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Onboarding
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}