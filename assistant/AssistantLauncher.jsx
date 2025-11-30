import React from 'react';
import { Rocket } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function AssistantLauncher({ isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "h-14 w-14 rounded-full",
        "bg-gradient-to-br from-indigo-600 to-purple-600",
        "shadow-lg shadow-indigo-500/30",
        "flex items-center justify-center",
        "hover:scale-105 active:scale-95",
        "transition-all duration-200",
        isOpen && "ring-4 ring-indigo-300 ring-opacity-50"
      )}
      aria-label="Open AI Assistant"
    >
      <Rocket 
        className={cn(
          "h-6 w-6 text-white transition-transform duration-300",
          isOpen ? "rotate-45" : "rotate-0"
        )} 
      />
    </button>
  );
}