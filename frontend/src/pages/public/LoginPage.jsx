import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ROLE_REDIRECT = {
  customer: '/',
  restaurant: '/restaurant/dashboard',
  delivery: '/delivery/dashboard',
  admin: '/admin/dashboard',
};

const QUICK_ACCOUNTS = [
  { label: 'Customer', email: 'ananya@bitestream.dev', role: 'customer' },
  { label: 'Restaurant', email: 'owner.mylari@bitestream.dev', role: 'restaurant' },
  { label: 'Delivery', email: 'rider.karthik@bitestream.dev', role: 'delivery' },
  { label: 'Admin', email: 'admin@bitestream.dev', role: 'admin' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const prefilledEmail = location.state?.email || 'ananya@bitestream.dev';
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('SeedPass@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedIn = await login({ email: email.trim(), password });
      toast.success(`Signed in as ${loggedIn.name} (${loggedIn.role})`);
      navigate(location.state?.from || ROLE_REDIRECT[loggedIn.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials or backend offline.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-5xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-xl md:grid-cols-12">
        <div className="flex flex-col justify-between bg-slate-950 p-8 text-white md:col-span-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live JWT + bcrypt Auth
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
              Welcome back to BiteStream
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Sign in with your MongoDB Atlas user account to place orders, run a kitchen, manage
              deliveries, or monitor platform operations.
            </p>
          </div>

          <div className="mt-8 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Seeded Test Accounts (Password: SeedPass@2026)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('SeedPass@2026');
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:border-orange-500/50 hover:text-white"
                >
                  {acc.label}
                  <span className="block truncate text-[10px] font-normal text-slate-400">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-8 md:col-span-7">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Sign In</h2>
            <p className="text-xs text-slate-500">
              Authenticates securely against MongoDB Atlas via JWT
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-stone-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-stone-200 py-2.5 pr-10 pl-10 text-sm outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Signing In...' : 'Sign In to BiteStream'}
          </button>

          <p className="text-center text-xs text-slate-500">
            New to BiteStream?{' '}
            <Link to="/register" className="font-bold text-orange-600 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
