import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  ShoppingBag,
  Store,
  Truck,
  Shield,
  User,
  X,
} from 'lucide-react';
import { MYSURU_ZONES } from '../../utils/geo';
import { useLocationContext } from '../../context/LocationContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from './Badge';
import NotificationBell from './NotificationBell';

const PORTAL_LINKS = [
  { to: '/restaurant/dashboard', label: 'Restaurant', icon: Store, role: 'restaurant' },
  { to: '/delivery/dashboard', label: 'Delivery', icon: Truck, role: 'delivery' },
  { to: '/admin/dashboard', label: 'Admin', icon: Shield, role: 'admin' },
];

export default function Navbar() {
  const { selectedZone, selectZoneById, openLocationModal } = useLocationContext();
  const { totals, openDrawer } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handlePortalJump = (portal) => {
    setMobileOpen(false);
    navigate(portal.to);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Left: Brand + Mysuru Location Picker */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 font-extrabold text-white shadow-md shadow-orange-500/25">
              B
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                Bite<span className="text-orange-600">Stream</span>
              </span>
              <span className="block text-[10px] font-medium text-slate-400">
                Mysuru Live Delivery
              </span>
            </div>
          </Link>

          {/* Mysuru Area Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoneMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-left text-xs transition hover:border-orange-300 hover:bg-orange-50/50 sm:text-sm"
            >
              <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
              <span className="max-w-[130px] truncate font-semibold text-slate-800 sm:max-w-[180px]">
                {selectedZone.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {zoneMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setZoneMenuOpen(false)}
                />
                <div className="absolute left-0 z-40 mt-2 w-72 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl animate-fade-in-up">
                  <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Select Mysuru Delivery Zone
                  </p>
                  {MYSURU_ZONES.map((zone) => {
                    const active = zone.id === selectedZone.id;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => {
                          selectZoneById(zone.id);
                          setZoneMenuOpen(false);
                        }}
                        className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                          active ? 'bg-orange-50 text-orange-700' : 'hover:bg-stone-50'
                        }`}
                      >
                        <MapPin
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            active ? 'text-orange-600' : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <p className="text-xs font-semibold">{zone.label}</p>
                          <p className="text-[11px] text-slate-500">{zone.address}</p>
                        </div>
                      </button>
                    );
                  })}
                  <div className="mt-1 border-t border-stone-100 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setZoneMenuOpen(false);
                        openLocationModal();
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-700"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Pin Exact Location on Map
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center/Right: Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-stone-100'
              }`
            }
          >
            Discover
          </NavLink>
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-stone-100'
              }`
            }
          >
            My Orders
          </NavLink>
          <div className="mx-2 h-5 w-px bg-stone-200" />
          {PORTAL_LINKS.map((portal) => {
            const Icon = portal.icon;
            return (
              <button
                key={portal.to}
                type="button"
                onClick={() => handlePortalJump(portal)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-stone-100 hover:text-slate-900"
              >
                <Icon className="h-3.5 w-3.5 text-slate-500" />
                {portal.label}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Notifications + Cart + Auth */}
        <div className="flex items-center gap-2">
          {isAuthenticated && <NotificationBell />}

          <button
            type="button"
            onClick={openDrawer}
            className="relative flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <ShoppingBag className="h-4 w-4 text-orange-400" />
            <span className="hidden sm:inline">Basket</span>
            {totals.itemCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white tabular-nums">
                {totals.itemCount}
              </span>
            )}
          </button>

          {isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-stone-300"
              >
                <User className="h-4 w-4 text-slate-500" />
                <span className="max-w-[96px] truncate">{user.name.split(' ')[0]}</span>
                <RoleBadge role={user.role} />
              </Link>
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:bg-stone-100 hover:text-slate-800"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-xl border border-stone-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-stone-100 sm:inline-flex"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="rounded-xl border border-stone-200 p-2 text-slate-700 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileOpen && (
        <div className="border-t border-stone-200 bg-white px-4 py-4 lg:hidden animate-fade-in-up">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-stone-100"
            >
              Discover Restaurants
            </Link>
            <Link
              to="/orders"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-stone-100"
            >
              My Orders &amp; Tracking
            </Link>
            <Link
              to="/profile"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-stone-100"
            >
              Profile &amp; Saved Addresses
            </Link>
            <div className="my-2 border-t border-stone-100" />
            <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Role Dashboards
            </p>
            {PORTAL_LINKS.map((portal) => {
              const Icon = portal.icon;
              return (
                <button
                  key={portal.to}
                  type="button"
                  onClick={() => handlePortalJump(portal)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                >
                  <Icon className="h-4 w-4" />
                  {portal.label} Dashboard
                </button>
              );
            })}
            <div className="my-2 border-t border-stone-100" />
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out ({user.name})
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-stone-200 py-2.5 text-center text-sm font-semibold text-slate-700"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-orange-600 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
