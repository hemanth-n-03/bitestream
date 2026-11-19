import { Check } from 'lucide-react';
import { ORDER_STATUS_META, ORDER_STEPS } from '../../utils/formatters';

export default function OrderTimeline({ status }) {
  if (status === 'CANCELLED' || status === 'REJECTED') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
        This order was {status.toLowerCase()}. Refunds (if paid) are processed automatically.
      </div>
    );
  }

  const activeIdx = ORDER_STEPS.indexOf(status);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[540px] items-center justify-between gap-2">
        {ORDER_STEPS.map((step, index) => {
          const completed = index <= activeIdx;
          const isCurrent = index === activeIdx;
          const meta = ORDER_STATUS_META[step];

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition ${
                    completed
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-stone-300 bg-white text-slate-400'
                  } ${isCurrent ? 'ring-4 ring-orange-500/20' : ''}`}
                >
                  {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-semibold ${
                    completed ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {meta.shortLabel}
                </span>
              </div>

              {index < ORDER_STEPS.length - 1 && (
                <div
                  className={`mx-1.5 mb-5 h-0.5 flex-1 rounded ${
                    index < activeIdx ? 'bg-emerald-500' : 'bg-stone-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
