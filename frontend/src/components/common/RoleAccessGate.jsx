import { Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLE_EMAIL_HINT = {
  customer: 'ananya@bitestream.dev',
  restaurant: 'owner.mylari@bitestream.dev',
  delivery: 'rider.karthik@bitestream.dev',
  admin: 'admin@bitestream.dev',
};

export default function RoleAccessGate({ allowedRoles, children }) {
  const { user, authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
          Verifying session...
        </div>
      </div>
    );
  }

  const primaryRole = allowedRoles[0];
  if (!isAuthenticated || !allowedRoles.includes(user?.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold text-slate-900">
            {isAuthenticated
              ? `Signed in as "${user.role}"`
              : 'Sign in required'}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            This portal requires <strong className="capitalize">{allowedRoles.join(' or ')}</strong>{' '}
            authentication. Sign in with an authorized MongoDB account (seeded demo:{' '}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-slate-800">
              {ROLE_EMAIL_HINT[primaryRole] || 'ananya@bitestream.dev'}
            </code>
            ).
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              state={{ email: ROLE_EMAIL_HINT[primaryRole] }}
              className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
            >
              Sign In as {primaryRole}
            </Link>
            <Link
              to="/"
              className="rounded-xl border border-stone-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-stone-50"
            >
              Back to Discovery
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
