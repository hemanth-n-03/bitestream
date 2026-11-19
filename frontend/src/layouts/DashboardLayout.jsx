import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, Shield, Store, Truck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { RoleBadge } from '../components/common/Badge';
import NotificationBell from '../components/common/NotificationBell';

const PORTAL_SWITCH = [
  { label: 'Restaurant', to: '/restaurant/dashboard', role: 'restaurant', icon: Store },
  { label: 'Delivery', to: '/delivery/dashboard', role: 'delivery', icon: Truck },
  { label: 'Admin', to: '/admin/dashboard', role: 'admin', icon: Shield },
];

export default function DashboardLayout({ title, subtitle, navItems, activeTab, onTabChange, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { connectionStatus } = useSocket();
  const navigate = useNavigate();

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 font-extrabold text-white">
            B
          </div>
          <div>
            <span className="text-base font-extrabold text-white">BiteStream</span>
            <span className="block text-[10px] font-medium text-slate-400">Operations Portal</span>
          </div>
        </Link>

        <div className="mt-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.badge != null && item.badge > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-800 text-orange-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 border-t border-slate-800 pt-4">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Switch Portal View
          </p>
          <div className="mt-2 space-y-1">
            {PORTAL_SWITCH.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.to}
                  type="button"
                  onClick={() => {
                    navigate(p.to);
                    setSidebarOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {p.label} Console
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Link
        to="/"
        className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-orange-500/40 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 text-orange-400" />
        Back to Customer App
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 bg-slate-950 lg:block">{SidebarContent}</aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <aside className="w-64 bg-slate-950 shadow-2xl">{SidebarContent}</aside>
          <div className="flex-1 bg-slate-950/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((p) => !p)}
              className="rounded-xl border border-stone-200 p-2 text-slate-700 lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold sm:inline-flex ${
                connectionStatus === 'connected'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : connectionStatus === 'reconnecting'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-stone-200 bg-stone-100 text-slate-600'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionStatus === 'reconnecting'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              {connectionStatus === 'connected'
                ? 'Change Streams Live'
                : connectionStatus === 'reconnecting'
                ? 'Reconnecting Socket...'
                : 'Fallback Sync'}
            </span>
            <NotificationBell />
            {user && (
              <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
                <span className="hidden sm:inline">{user.name}</span>
                <RoleBadge role={user.role} />
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
