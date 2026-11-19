import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  MapPin,
  Search,
  ShoppingBag,
  Star,
  Utensils,
} from 'lucide-react';
import { useLocationContext } from '../../context/LocationContext';
import { useCart } from '../../context/CartContext';
import { useSocket } from '../../context/SocketContext';
import { fetchRestaurantDetails, fetchRestaurantMenu } from '../../api/restaurantApi';
import { estimateDeliveryMinutes } from '../../utils/geo';
import { formatDistanceKm, formatINR } from '../../utils/formatters';
import FoodItemCard from '../../components/customer/FoodItemCard';
import EmptyState from '../../components/common/EmptyState';

export default function RestaurantDetailsPage() {
  const { id } = useParams();
  const { selectedZone } = useLocationContext();
  const { totals, openDrawer } = useCart();
  const { subscribe } = useSocket();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [menuQuery, setMenuQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRestaurantAndMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [longitude, latitude] = selectedZone.coordinates;

    try {
      const [detailRes, menuRes] = await Promise.all([
        fetchRestaurantDetails(id, { latitude, longitude }),
        fetchRestaurantMenu(id, {
          category: selectedCategory,
          search: menuQuery,
          vegOnly,
        }),
      ]);

      setRestaurant(detailRes.restaurant);
      setMenuItems(menuRes.items);
      setCategories(menuRes.categories);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to load restaurant details from BiteStream API.'
      );
      setRestaurant(null);
    } finally {
      setLoading(false);
    }
  }, [id, selectedZone.coordinates, selectedCategory, menuQuery, vegOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRestaurantAndMenu();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadRestaurantAndMenu]);

  useEffect(() => {
    return subscribe('RESTAURANT_STATUS_UPDATED', (payload) => {
      if (payload?.restaurantId === id && payload?.restaurant) {
        setRestaurant((prev) =>
          prev
            ? {
                ...prev,
                isOpen: payload.restaurant.isOpen,
                isActive: payload.restaurant.isActive,
              }
            : prev
        );
      }
    });
  }, [id, subscribe]);

  if (loading && !restaurant) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
          Loading Mysuru kitchen &amp; menu from MongoDB...
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <EmptyState
          icon={error ? AlertCircle : Utensils}
          title={error ? 'Unable to load restaurant' : 'Restaurant not found'}
          description={
            error || 'The kitchen you requested is unavailable or could not be found.'
          }
          action={
            <Link
              to="/"
              className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
            >
              Back to Discovery
            </Link>
          }
        />
      </div>
    );
  }

  const distanceKm = restaurant.distanceKm;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-orange-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Mysuru Restaurants
      </Link>

      {/* Restaurant Header Banner */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="grid md:grid-cols-12">
          <div className="h-52 bg-stone-200 md:col-span-5 md:h-auto">
            <img
              src={restaurant.image}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-between p-6 md:col-span-7">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        restaurant.isOpen
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {restaurant.isOpen ? 'Open Now' : 'Closed'}
                    </span>
                    {restaurant.isVegOnly && (
                      <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        Pure Veg
                      </span>
                    )}
                  </div>
                  <h1 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                    {restaurant.name}
                  </h1>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {restaurant.cuisines.join(' • ')}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-emerald-700 tabular-nums">
                    {(restaurant.rating?.average ?? 4.5).toFixed(1)}
                    <Star className="h-3.5 w-3.5 fill-current" />
                  </div>
                  <p className="text-[10px] font-semibold text-emerald-700">
                    {restaurant.rating?.count ?? 0}+ ratings
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {restaurant.description}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-stone-100 pt-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="h-4 w-4 text-orange-600" />
                {restaurant.fullAddress} ({formatDistanceKm(distanceKm)})
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-4 w-4 text-slate-500" />
                {estimateDeliveryMinutes(distanceKm, restaurant.prepTimeMins)} • Open{' '}
                {restaurant.openingHours?.open}–{restaurant.openingHours?.close}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills & Menu Filter Bar */}
      <div className="mt-8 space-y-4">
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['All', ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'border-orange-600 bg-orange-600 text-white'
                    : 'border-stone-200 bg-white text-slate-700 hover:border-orange-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              placeholder="Search dishes in this menu..."
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setVegOnly((p) => !p)}
            className={`inline-flex items-center gap-2 self-start rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              vegOnly
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-stone-200 bg-white text-slate-700'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Veg Items Only
          </button>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {menuItems.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState
              icon={Utensils}
              title="No menu items match your filter"
              description="Try clearing the search input, switching categories, or toggling Veg Only."
            />
          </div>
        ) : (
          menuItems.map((item) => (
            <FoodItemCard key={item.id} item={item} restaurant={restaurant} />
          ))
        )}
      </div>

      {/* Floating Basket Strip */}
      {totals.itemCount > 0 && (
        <div className="sticky bottom-4 z-30 mt-8">
          <button
            type="button"
            onClick={openDrawer}
            className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-2xl transition hover:bg-slate-800"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold tabular-nums">
                  {totals.itemCount} item{totals.itemCount > 1 ? 's' : ''} •{' '}
                  {formatINR(totals.itemsTotal)}
                </p>
                <p className="text-[11px] text-slate-300">Extra charges may apply at checkout</p>
              </div>
            </div>
            <span className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold">
              View Basket
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
