import { Link } from 'react-router-dom';
import { Database, MapPin, Radio } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-sm font-extrabold text-white">
              B
            </div>
            <span className="text-base font-extrabold text-slate-900">BiteStream</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Real-time food delivery management platform engineered around MongoDB 2dsphere
            geospatial indexing and Change Streams. Currently running Phase 2 Mysuru UI preview.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Customer Experience
          </h4>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            <li>
              <Link to="/" className="hover:text-orange-600">
                Discover Nearby Kitchens
              </Link>
            </li>
            <li>
              <Link to="/orders" className="hover:text-orange-600">
                Live Order Timeline
              </Link>
            </li>
            <li>
              <Link to="/profile" className="hover:text-orange-600">
                Saved Mysuru Addresses
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Partner Portals
          </h4>
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            <li>
              <Link to="/restaurant/dashboard" className="hover:text-orange-600">
                Restaurant Kitchen Dashboard
              </Link>
            </li>
            <li>
              <Link to="/delivery/dashboard" className="hover:text-orange-600">
                Delivery Partner Console
              </Link>
            </li>
            <li>
              <Link to="/admin/dashboard" className="hover:text-orange-600">
                Admin Operations Center
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Architecture Stack
          </h4>
          <div className="mt-3 space-y-2 text-xs text-slate-500">
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-orange-600" />
              2dsphere GeoJSON [lng, lat] (Phase 5)
            </p>
            <p className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-emerald-600" />
              Change Streams + Socket.IO (Phase 7)
            </p>
            <p className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-amber-600" />
              Temporary Mock Data (Phase 2)
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-100 bg-stone-50 px-4 py-4 text-center text-xs text-slate-500">
        BiteStream • Real-Time Food Delivery Management System (Mysuru Preview Dataset)
      </div>
    </footer>
  );
}
