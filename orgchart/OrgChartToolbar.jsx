import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  ChevronsDownUp,
  ChevronsUpDown,
  Download
} from 'lucide-react';

export default function OrgChartToolbar({ 
  onZoomIn, 
  onZoomOut, 
  onFitToScreen, 
  onExpandAll, 
  onCollapseAll,
  onExport,
  zoom
}) {
  return (
    <TooltipProvider>
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 bg-white rounded-xl shadow-lg border p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom in</TooltipContent>
        </Tooltip>

        <div className="text-xs text-center text-gray-500 py-1">
          {zoom}%
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom out</TooltipContent>
        </Tooltip>

        <div className="h-px bg-gray-200 my-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onFitToScreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Fit to screen</TooltipContent>
        </Tooltip>

        <div className="h-px bg-gray-200 my-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onExpandAll}>
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Expand all</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onCollapseAll}>
              <ChevronsDownUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Collapse all</TooltipContent>
        </Tooltip>

        <div className="h-px bg-gray-200 my-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Export as image</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}