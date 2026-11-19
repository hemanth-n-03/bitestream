import { useState } from 'react';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { formatShortTime } from '../../utils/formatters';

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, isConnected } = useSocket();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-slate-600 transition hover:border-orange-300 hover:bg-orange-50/40 hover:text-slate-900"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-extrabold text-white tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:w-96 animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">Notifications</h3>
                <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {isConnected ? 'Live MongoDB Change Streams' : 'Reconnecting stream...'}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-stone-200"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-500">
                  No notifications yet. Live order &amp; delivery updates appear here.
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => {
                      if (!n.isRead) markRead(n._id);
                    }}
                    className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-stone-50 ${
                      !n.isRead ? 'bg-orange-50/40' : 'bg-white'
                    }`}
                  >
                    <Circle
                      className={`mt-1 h-2 w-2 shrink-0 ${
                        !n.isRead
                          ? 'fill-orange-600 text-orange-600'
                          : 'fill-stone-300 text-stone-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900">{n.title}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatShortTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                        {n.message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
