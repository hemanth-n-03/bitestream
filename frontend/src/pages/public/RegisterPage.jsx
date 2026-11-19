import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'customer',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await register(form);
      toast.success(`Welcome to BiteStream, ${created.name}!`);
      if (created.role === 'restaurant') navigate('/restaurant/dashboard');
      else if (created.role === 'delivery') navigate('/delivery/dashboard');
      else navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-xl items-center px-4 py-10 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-5 rounded-3xl border border-stone-200 bg-white p-8 shadow-xl"
      >
        <div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
            Join BiteStream Mysuru
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Create your account</h1>
          <p className="text-xs text-slate-500">
            Registers a secure MongoDB Atlas user with bcrypt password hashing and JWT
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Full Name</label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="name"
              required
              minLength={2}
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., Priya Sharma"
              className="w-full rounded-xl border border-stone-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-stone-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Phone</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="phone"
                required
                minLength={8}
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98450 00000"
                className="w-full rounded-xl border border-stone-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={handleChange}
                placeholder="Min 8 characters"
                className="w-full rounded-xl border border-stone-200 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Account Type</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-orange-500"
            >
              <option value="customer">Customer</option>
              <option value="restaurant">Restaurant Partner</option>
              <option value="delivery">Delivery Partner</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Creating Account...' : 'Create Account'}
        </button>

        <p className="text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-orange-600 hover:underline">
            Sign in instead
          </Link>
        </p>
      </form>
    </div>
  );
}
