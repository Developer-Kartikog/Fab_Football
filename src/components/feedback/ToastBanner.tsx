import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useTacticalStore } from '@/store/useTacticalStore';

export function ToastBanner() {
  const toast = useTacticalStore((s) => s.toast);
  const clearToast = useTacticalStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const styles = {
    success: 'border-emerald-500/40 bg-[#15241d] text-emerald-100',
    info: 'border-sky-500/40 bg-[#151e28] text-sky-100',
    warning: 'border-amber-500/40 bg-[#261f12] text-amber-100',
    error: 'border-red-500/40 bg-[#281517] text-red-100',
  }[toast.type];

  const Icon =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error' || toast.type === 'warning'
        ? AlertCircle
        : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-18 left-1/2 z-40 w-[min(92vw,32rem)] -translate-x-1/2 sm:bottom-20"
    >
      <div
        className={`pointer-events-auto flex items-center justify-between gap-2.5 rounded-md border px-3.5 py-2 text-xs font-medium shadow-lg sm:text-sm ${styles}`}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span>{toast.text}</span>
        </div>
        <button
          type="button"
          onClick={clearToast}
          aria-label="Dismiss notification"
          className="rounded p-0.5 opacity-75 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
