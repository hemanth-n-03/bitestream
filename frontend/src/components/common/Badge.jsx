import { ORDER_STATUS_META } from '../../utils/formatters';

export function StatusBadge({ status }) {
  const meta = ORDER_STATUS_META[status] || {
    label: status,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}

export function VegIndicator({ isVeg, size = 'sm' }) {
  const boxClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const dotClass = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <span
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] border ${boxClass} ${
        isVeg ? 'border-emerald-600' : 'border-rose-600'
      }`}
    >
      <span
        className={`rounded-full ${dotClass} ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`}
      />
    </span>
  );
}

const ROLE_STYLES = {
  customer: 'bg-orange-100 text-orange-800 border-orange-200',
  restaurant: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  delivery: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  admin: 'bg-slate-900 text-white border-slate-800',
};

export function RoleBadge({ role }) {
  const style = ROLE_STYLES[role] || 'bg-slate-100 text-slate-800 border-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${style}`}
    >
      {role}
    </span>
  );
}
