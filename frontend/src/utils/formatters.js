export const ORDER_STEPS = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const ORDER_STATUS_META = {
  PLACED: {
    label: 'Order Placed',
    shortLabel: 'Placed',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  ACCEPTED: {
    label: 'Accepted by Kitchen',
    shortLabel: 'Accepted',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  PREPARING: {
    label: 'Preparing Food',
    shortLabel: 'Preparing',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotClass: 'bg-indigo-500',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    shortLabel: 'Ready',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
    dotClass: 'bg-violet-500',
  },
  PICKED_UP: {
    label: 'Picked Up by Rider',
    shortLabel: 'Picked Up',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dotClass: 'bg-cyan-500',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    shortLabel: 'On the Way',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  DELIVERED: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  REJECTED: {
    label: 'Rejected',
    shortLabel: 'Rejected',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-500',
  },
};

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

export function formatDistanceKm(km) {
  if (km == null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatShortTime(isoDate) {
  if (!isoDate) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(isoDate));
}
