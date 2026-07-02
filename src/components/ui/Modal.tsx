"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type Width = "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
const WIDTH_CLASSES: Record<Width, string> = {
  md:  "max-w-md",
  lg:  "max-w-2xl",
  xl:  "max-w-4xl",
  "2xl": "max-w-6xl",
  "3xl": "max-w-7xl",
  full: "max-w-[95vw]",
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: Width;
  subtitle?: string;
};

// Module-level stack of open modal close handlers. The topmost (last pushed)
// is the only one that should react to a global ESC keypress.
const modalStack: Array<() => void> = [];

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const top = modalStack[modalStack.length - 1];
    if (top) top();
  });
}

export function Modal({ open, onClose, title, children, width = "lg" }: Props) {
  useEffect(() => {
    if (!open) return;
    modalStack.push(onClose);
    return () => {
      const idx = modalStack.lastIndexOf(onClose);
      if (idx !== -1) modalStack.splice(idx, 1);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className={`relative bg-white rounded-card shadow-2xl ring-1 ring-slate-200 w-full ${WIDTH_CLASSES[width]} mx-4 max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-navy tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
