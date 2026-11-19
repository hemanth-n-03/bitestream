import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const TOAST_STYLES = {
  success: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
  },
  error: {
    container: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: AlertCircle,
    iconColor: 'text-rose-600',
  },
  info: {
    container: 'border-slate-200 bg-white text-slate-900',
    icon: Info,
    iconColor: 'text-orange-500',
  },
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((item) => {
        const style = TOAST_STYLES[item.type] || TOAST_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg animate-fade-in-up ${style.container}`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${style.iconColor}`} />
            <p className="flex-1 text-sm font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="rounded p-0.5 opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
