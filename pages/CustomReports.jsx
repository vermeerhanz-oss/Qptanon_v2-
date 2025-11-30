import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Loader2, FileX } from 'lucide-react';
import { getCurrentUserEmployeeContext } from '@/components/utils/EmployeeContext';
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CustomReports() {
  const [context, setContext] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    getCurrentUserEmployeeContext().then(setContext);
  }, []);

  const { isAllowed, isLoading } = useRequirePermission(context, 'canViewReports');

  if (isLoading || !isAllowed) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Custom Reports</h1>
        </div>
        <p className="text-gray-600">
          Build your own HR and people datasets.
        </p>
      </div>

      <div className="mb-8">
        <Button 
          size="lg" 
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Create custom report
        </Button>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Saved Reports</h2>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <FileX className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No custom reports yet</h3>
              <p className="text-gray-500">
                You don't have any custom reports yet. Create your first custom report to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New custom report</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              Custom reporting builder coming soon.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}