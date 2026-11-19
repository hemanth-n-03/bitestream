import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Database,
  Flame,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  SplitSquareHorizontal,
  Utensils,
} from 'lucide-react';
import { useLocationContext } from '../../context/LocationContext';
import { useSocket } from '../../context/SocketContext';
import {
  fetchCategories,
  fetchNearbyRestaurants,
  searchRestaurantsAndDishes,
} from '../../api/restaurantApi';
import CategoryBar from '../../components/customer/CategoryBar';
import RestaurantCard from '../../components/customer/RestaurantCard';
import FoodItemCard from '../../components/customer/FoodItemCard';
import NearbyRestaurantsMap from '../../components/maps/NearbyRestaurantsMap';
import EmptyState from '../../components/common/EmptyState';

const VIEW_MODES = [
  { id: 'split', label: 'Map + List', icon: SplitSquareHorizontal },
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'map', label: 'Full Map', icon: MapIcon },
];

const RADIUS_OPTIONS = [
  { value: 25, label: 'All Mysuru' },
  { value: 2, label: '≤ 2 km' },
  { value: 5, label: '≤ 5 km' },
  { value: 10, label: '≤ 10 km' },
];

const GEO_MODES = [
  { value: 'geoNear', label: '$geoNear' },
  { value: 'near', label: '$near' },
  { value: 'geoWithin', label: '$geoWithin' },
];

export default function HomePage() {
  const { selectedZone, openLocationModal } = useLocationContext();
  const { subscribe } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);
  const [sortBy, setSortBy] = useState('distance');
  const [radiusKm, setRadiusKm] = useState(25);
  const [geoMode, setGeoMode] = useState('geoNear');
  const [viewMode, setViewMode] = useState('split');

  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [featuredDishes, setFeaturedDishes] = useState([]);
  const [queryInfo, setQueryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 260);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((cats) => {
        if (active) setCategories(cats);
      })
      .catch(() => {
        // Fallback categories in CategoryBar remain available
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return subscribe('RESTAURANT_STATUS_UPDATED', (payload) => {
      if (!payload?.restaurantId || !payload?.restaurant) return;
      setRestaurants((prev) =>
        prev.map((r) =>
          (r.id || r._id) === payload.restaurantId
            ? {
                ...r,
                isOpen: payload.restaurant.isOpen,
                isActive: payload.restaurant.isActive,
                location: payload.restaurant.location || r.location,
              }
            : r
        )
      );
    });
  }, [subscribe]);

  const loadDiscovery = useCallback(async () => {
    const [longitude, latitude] = selectedZone.coordinates;
    setLoading(true);
    setError(null);

    try {
      const [nearbyRes, dishRes] = await Promise.all([
        fetchNearbyRestaurants({
          latitude,
          longitude,
          radius: radiusKm,
          category: selectedCategory,
          search: debouncedSearch,
          sort: sortBy,
          vegOnly,
          mode: geoMode,
          limit: 30,
        }),
        searchRestaurantsAndDishes({
          q: debouncedSearch,
          category: selectedCategory,
          vegOnly,
          latitude,
          longitude,
          limit: 12,
        }),
      ]);

      setRestaurants(nearbyRes.restaurants);
      setQueryInfo(nearbyRes.queryInfo);
      setFeaturedDishes(dishRes.dishes);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to connect to BiteStream backend API. Ensure the backend server is running on port 5000.'
      );
      setRestaurants([]);
      setFeaturedDishes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedZone.coordinates, radiusKm, selectedCategory, debouncedSearch, sortBy, vegOnly, geoMode]);

  useEffect(() => {
    loadDiscovery();
  }, [loadDiscovery]);

  const resetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedCategory('All');
    setVegOnly(false);
    setRadiusKm(25);
  };

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-14">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live MongoDB Atlas • 2dsphere Discovery &amp; Change Streams
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
              Fresh Mysuru flavours, tracked{' '}
              <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                in real time.
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Discover kitchens closest to{' '}
              <span className="font-semibold text-white">{selectedZone.label}</span> using live
              MongoDB Atlas <code className="text-orange-300">2dsphere</code> proximity queries.
            </p>

            {/* Search Input */}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Mysuru dishes, biryani, dosa, or areas..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 py-3.5 pr-4 pl-11 text-sm text-white placeholder:text-slate-400 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <button
                type="button"
                onClick={openLocationModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-600/20 px-4 py-3 text-xs font-bold text-orange-200 transition hover:bg-orange-600 hover:text-white"
              >
                <MapPin className="h-4 w-4" />
                Pin on Map
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange-400" />
                GeoJSON [{selectedZone.coordinates[0].toFixed(4)},{' '}
                {selectedZone.coordinates[1].toFixed(4)}]
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                Active Index Query: {queryInfo?.operator || '$geoNear'}
              </span>
            </div>
          </div>

          {/* Right Highlight Card */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl">
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4">
                <Flame className="h-5 w-5 text-orange-400" />
                <p className="mt-2 text-2xl font-extrabold text-white tabular-nums">
                  {restaurants.length}
                </p>
                <p className="text-xs text-slate-400">Matched Nearby Kitchens</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4">
                <Utensils className="h-5 w-5 text-emerald-400" />
                <p className="mt-2 text-2xl font-extrabold text-white tabular-nums">
                  {categories.length || 7}
                </p>
                <p className="text-xs text-slate-400">MongoDB Categories</p>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/90 p-4">
                <div>
                  <p className="text-xs font-bold text-white">Live Delivery Tracking</p>
                  <p className="text-[11px] text-slate-400">
                    Inspect Leaflet rider-to-customer routes
                  </p>
                </div>
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-orange-700"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Track Orders
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Discovery Content */}
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <CategoryBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          vegOnly={vegOnly}
          onToggleVeg={() => setVegOnly((p) => !p)}
          sortBy={sortBy}
          onChangeSort={setSortBy}
        />

        {/* Radius + MongoDB Geospatial Operator + View Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Radius:</span>
            {RADIUS_OPTIONS.map((opt) => {
              const active = radiusKm === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setRadiusKm(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}

            <div className="mx-1 hidden h-4 w-px bg-stone-200 sm:block" />
            <span className="text-xs font-bold text-slate-500">Query:</span>
            {GEO_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setGeoMode(m.value)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                  geoMode === m.value
                    ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const active = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <span className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              {error}
            </span>
            <button
              type="button"
              onClick={loadDiscovery}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Discovery Map + List Views */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Restaurants near {selectedZone.label}
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Powered by MongoDB{' '}
                <code className="rounded bg-stone-200/70 px-1 text-slate-800">
                  {queryInfo?.operator || '$geoNear'}
                </code>{' '}
                within{' '}
                <span className="font-semibold text-slate-700">{radiusKm} km</span> (
                {radiusKm * 1000} m)
              </p>
            </div>
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 tabular-nums">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-600" />}
              {restaurants.length} found
            </span>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-72 animate-pulse rounded-2xl border border-stone-200 bg-stone-200/60"
                />
              ))}
            </div>
          ) : (
            <>
              {viewMode === 'map' && (
                <NearbyRestaurantsMap
                  customerZone={selectedZone}
                  restaurants={restaurants}
                  radiusKm={radiusKm < 25 ? radiusKm : null}
                  heightClass="h-[420px] sm:h-[520px]"
                />
              )}

              {viewMode === 'split' && (
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
                    <NearbyRestaurantsMap
                      customerZone={selectedZone}
                      restaurants={restaurants}
                      radiusKm={radiusKm < 25 ? radiusKm : null}
                      heightClass="h-[340px] lg:h-[520px]"
                    />
                  </div>
                  <div className="lg:col-span-7">
                    {restaurants.length === 0 ? (
                      <EmptyState
                        icon={Utensils}
                        title="No kitchens within selected radius/filters"
                        description="Try expanding your radius to All Mysuru or resetting filters."
                        action={
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
                          >
                            Reset Filters
                          </button>
                        }
                      />
                    ) : (
                      <div className="grid gap-5 sm:grid-cols-2">
                        {restaurants.map((rest) => (
                          <RestaurantCard
                            key={rest.id}
                            restaurant={rest}
                            distanceKm={rest.distanceKm}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewMode === 'grid' &&
                (restaurants.length === 0 ? (
                  <EmptyState
                    icon={Utensils}
                    title="No matching kitchens found"
                    description="Try clearing your search query, expanding radius, or toggling Pure Veg."
                    action={
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
                      >
                        Reset Filters
                      </button>
                    }
                  />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {restaurants.map((rest) => (
                      <RestaurantCard
                        key={rest.id}
                        restaurant={rest}
                        distanceKm={rest.distanceKm}
                      />
                    ))}
                  </div>
                ))}
            </>
          )}
        </section>

        {/* Popular / Matching Dishes Quick Add */}
        {!loading && featuredDishes.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                {debouncedSearch ? 'Matching Dishes' : 'Mysuru Bestsellers'}
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Loaded live from MongoDB food_items • Quick-add to your basket
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {featuredDishes.map((dish) => (
                <FoodItemCard
                  key={dish.id}
                  item={dish}
                  restaurant={dish.restaurant}
                  showRestaurantName
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
