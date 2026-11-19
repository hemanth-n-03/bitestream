import { useState } from 'react';
import { Loader2, MapPin, Save, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocationContext } from '../../context/LocationContext';
import { useToast } from '../../context/ToastContext';
import { RoleBadge } from '../../components/common/Badge';
import RoleAccessGate from '../../components/common/RoleAccessGate';
import LocationPickerMap from '../../components/maps/LocationPickerMap';

function ProfileContent() {
  const { user, updateProfile } = useAuth();
  const { selectedZone, setCustomCoordinates } = useLocationContext();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [label, setLabel] = useState(user?.address?.label || 'Home');
  const [street, setStreet] = useState(user?.address?.street || selectedZone.address);
  const [area, setArea] = useState(user?.address?.area || selectedZone.label);
  const [coords, setCoords] = useState(
    user?.address?.location?.coordinates || selectedZone.coordinates
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        name,
        phone,
        address: {
          label,
          street,
          area,
          city: 'Mysuru',
          location: { type: 'Point', coordinates: coords },
        },
      });
      setCustomCoordinates(coords, label || area, street);
      toast.success('Profile & delivery pin saved to MongoDB.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Account &amp; Saved Pin</h1>
          <p className="text-xs text-slate-500">
            Persists directly to your MongoDB user profile
          </p>
        </div>
        {user && <RoleBadge role={user.role} />}
      </div>

      <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-12">
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 md:col-span-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <User className="h-4 w-4 text-orange-600" />
            Profile &amp; Address
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Full Name</label>
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
            <input
              disabled
              value={user?.email || ''}
              className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Phone</label>
            <input
              required
              minLength={8}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Area</label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Street</label>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save Profile & Pin'}
          </button>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 md:col-span-7">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <MapPin className="h-4 w-4 text-orange-600" />
            Pin Saved Delivery Coordinates
          </h2>
          <LocationPickerMap
            coordinates={coords}
            pinLabel={label || 'Saved Pin'}
            onChangeCoordinates={(nextCoords, nextLabel, nextAddr) => {
              setCoords(nextCoords);
              if (nextAddr) setStreet(nextAddr);
              if (nextLabel && !nextLabel.includes('Pin')) setArea(nextLabel);
            }}
            heightClass="h-80"
          />
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RoleAccessGate allowedRoles={['customer', 'restaurant', 'delivery', 'admin']}>
      <ProfileContent />
    </RoleAccessGate>
  );
}
