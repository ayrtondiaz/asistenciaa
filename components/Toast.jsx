"use client";

import { useApp } from "@/context/AppContext";

const TOAST_STYLES = {
  success: "bg-[var(--color-success)] text-white",
  error: "bg-[var(--color-error)] text-white",
  warning: "bg-[var(--color-warning)] text-white",
  info: "bg-[var(--color-accent)] text-white",
};

export default function Toast() {
  const { toast } = useApp();

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-toast-in">
      <div className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${TOAST_STYLES[toast.type] || TOAST_STYLES.info}`}>
        {toast.message}
      </div>
    </div>
  );
}
