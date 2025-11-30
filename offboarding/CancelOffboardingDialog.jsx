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
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';

export default function CancelOffboardingDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isProcessing,
  employeeName 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Offboarding</DialogTitle>
          <DialogDescription>
            <div className="flex items-start gap-2 mt-2 p-3 bg-yellow-50 rounded-lg text-yellow-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>
                Are you sure you want to cancel the offboarding for <strong>{employeeName}</strong>?
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          This will:
        </p>
        <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
          <li>Set the offboarding status to <strong>Cancelled</strong></li>
          <li>Restore the employee's status to <strong>Active</strong></li>
          <li>Keep all records for audit purposes</li>
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Keep Offboarding
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isProcessing}
            variant="destructive"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Offboarding
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}