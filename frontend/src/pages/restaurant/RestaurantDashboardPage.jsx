import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  IndianRupee,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Store,
  Trash2,
  Truck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import RoleAccessGate from '../../components/common/RoleAccessGate';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import LocationPickerMap from '../../components/maps/LocationPickerMap';
import { StatusBadge, VegIndicator } from '../../components/common/Badge';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchOwnerRestaurantsApi,
  toggleRestaurantOpenApi,
  updateRestaurantLocationApi,
} from '../../api/restaurantApi';
import {
  fetchRestaurantOrdersApi,
  reassignOrderDeliveryApi,
  updateOrderStatusApi,
} from '../../api/orderApi';
import {
  createFoodItemApi,
  deleteFoodItemApi,
  fetchOwnerMenuApi,
  toggleFoodAvailabilityApi,
  updateFoodItemApi,
} from '../../api/foodApi';
import { formatINR, formatShortTime } from '../../utils/formatters';
import { playNewOrderChime } from '../../utils/sound';

const NEXT_STAGE_MAP = {
  PLACED: { next: 'ACCEPTED', label: 'Accept Order', btnClass: 'bg-emerald-600 hover:bg-emerald-700' },
  ACCEPTED: { next: 'PREPARING', label: 'Start Preparing', btnClass: 'bg-indigo-600 hover:bg-indigo-700' },
  PREPARING: { next: 'READY_FOR_PICKUP', label: 'Mark Ready for Pickup', btnClass: 'bg-violet-600 hover:bg-violet-700' },
};

const MENU_CATEGORIES = [
  'South Indian',
  'Biryani',
  'North Indian',
  'Bowls',
  'Street Food',
  'Desserts',
  'Beverages',
];

const EMPTY_DISH = {
  name: '',
  description: '',
  price: '',
  category: 'South Indian',
  isVeg: true,
};

function RestaurantDashboardContent() {
  const { toast } = useToast();
  const { isConnected, reconnectNonce, subscribe } = useSocket();
  const [activeTab, setActiveTab] = useState('orders');
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestId, setSelectedRestId] = useState('');
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reassigningId, setReassigningId] = useState(null);
  const [soundMuted, setSoundMuted] = useState(() => {
    try {
      return localStorage.getItem('bitestream_kitchen_muted') === 'true';
    } catch {
      return false;
    }
  });

  const [dishModalOpen, setDishModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [dishForm, setDishForm] = useState(EMPTY_DISH);
  const [savingDish, setSavingDish] = useState(false);

  const restaurant = restaurants.find((r) => r.id === selectedRestId) || restaurants[0] || null;

  const [draftStreet, setDraftStreet] = useState('');
  const [draftArea, setDraftArea] = useState('');
  const [draftCoords, setDraftCoords] = useState([76.6634, 12.3079]);

  const loadRestaurants = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchOwnerRestaurantsApi();
      setRestaurants(list);
      if (list.length > 0 && !selectedRestId) {
        setSelectedRestId(list[0].id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load restaurant profile.');
    } finally {
      setLoading(false);
    }
  }, [selectedRestId, toast]);

  useEffect(() => {
    loadRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRestaurantData = useCallback(async () => {
    if (!restaurant?.id) return;
    try {
      const [ordersRes, menuRes] = await Promise.all([
        fetchRestaurantOrdersApi({ restaurantId: restaurant.id, limit: 40 }),
        fetchOwnerMenuApi(restaurant.id),
      ]);
      setOrders(ordersRes.orders || []);
      setMenu(menuRes || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load kitchen data.');
    }
  }, [restaurant?.id, toast]);

  useEffect(() => {
    if (restaurant) {
      setDraftStreet(restaurant.address?.street || '');
      setDraftArea(restaurant.address?.area || '');
      setDraftCoords(restaurant.location?.coordinates || [76.6634, 12.3079]);
      loadRestaurantData();
    }
  }, [restaurant, loadRestaurantData]);

  useEffect(() => {
    if (reconnectNonce > 0 && restaurant?.id) {
      loadRestaurantData();
    }
  }, [reconnectNonce, restaurant?.id, loadRestaurantData]);

  // Fallback refresh ONLY when Socket.IO is disconnected
  useEffect(() => {
    if (isConnected || !restaurant?.id) return undefined;
    const timer = setInterval(() => {
      loadRestaurantData();
    }, 15000);
    return () => clearInterval(timer);
  }, [isConnected, restaurant?.id, loadRestaurantData]);

  // Real-time MongoDB Change Stream listeners for incoming orders, status updates & assignments
  useEffect(() => {
    const activeId = restaurant?.id;
    if (!activeId) return undefined;

    const unsubOrders = subscribe(
      [
        'ORDER_CREATED',
        'ORDER_ACCEPTED',
        'ORDER_REJECTED',
        'ORDER_CANCELLED',
        'ORDER_STATUS_UPDATED',
        'DELIVERY_ASSIGNED',
        'DELIVERY_PICKED_UP',
        'DELIVERY_COMPLETED',
      ],
      (payload, eventName) => {
        const incoming = payload?.order;
        if (!incoming?._id) return;
        const incomingRestId =
          typeof incoming.restaurantId === 'object'
            ? incoming.restaurantId._id
            : incoming.restaurantId;
        if (incomingRestId !== activeId) return;

        setOrders((prev) => {
          const idx = prev.findIndex((o) => o._id === incoming._id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = incoming;
            return next;
          }
          return [incoming, ...prev];
        });

        if (eventName === 'ORDER_CREATED') {
          if (!soundMuted) {
            playNewOrderChime();
          }
          toast.success(`New incoming order ${incoming.orderNumber}!`);
        }
      }
    );

    const unsubRest = subscribe('RESTAURANT_STATUS_UPDATED', (payload) => {
      if (!payload?.restaurantId || !payload?.restaurant) return;
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === payload.restaurantId
            ? { ...r, isOpen: payload.restaurant.isOpen, isActive: payload.restaurant.isActive }
            : r
        )
      );
    });

    return () => {
      unsubOrders();
      unsubRest();
    };
  }, [restaurant?.id, subscribe, soundMuted, toast]);

  const toggleSoundMute = () => {
    setSoundMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bitestream_kitchen_muted', String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const incomingCount = useMemo(
    () => orders.filter((o) => ['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status)).length,
    [orders]
  );

  const revenue = useMemo(
    () =>
      orders
        .filter((o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.itemsTotal, 0),
    [orders]
  );

  const navItems = [
    { id: 'orders', label: 'Incoming Orders', icon: ClipboardList, badge: incomingCount },
    { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed, badge: menu.length },
    { id: 'profile', label: 'Kitchen Location', icon: Store },
  ];

  const handleTransition = async (order, nextStatus) => {
    try {
      const updated = await updateOrderStatusApi(order._id, { status: nextStatus });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? updated : o)));
      if (nextStatus === 'READY_FOR_PICKUP' && updated.assignmentOutcome) {
        if (updated.assignmentOutcome.assigned) {
          toast.success(
            `Order ${order.orderNumber} ready — ${updated.assignmentOutcome.message}`
          );
        } else {
          toast.info(updated.assignmentOutcome.message);
        }
      } else {
        toast.success(`Order ${order.orderNumber} → ${nextStatus}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed.');
    }
  };

  const handleRetryAssignment = async (order, releaseCurrentPartner = false) => {
    setReassigningId(order._id);
    try {
      const res = await reassignOrderDeliveryApi(order._id, {
        resetExcluded: true,
        releaseCurrentPartner,
      });
      if (res.order) {
        setOrders((prev) => prev.map((o) => (o._id === order._id ? res.order : o)));
      }
      if (res.assignment?.assigned) {
        toast.success(res.assignment.message);
      } else {
        toast.info(res.assignment?.message || 'No nearby online rider available yet.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reassignment attempt failed.');
    } finally {
      setReassigningId(null);
    }
  };

  const handleToggleOpen = async () => {
    if (!restaurant) return;
    try {
      const updated = await toggleRestaurantOpenApi(restaurant.id, !restaurant.isOpen);
      setRestaurants((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.info(`${updated.name} marked ${updated.isOpen ? 'Open' : 'Closed'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle kitchen status.');
    }
  };

  const handleSaveLocation = async () => {
    if (!restaurant) return;
    try {
      const updated = await updateRestaurantLocationApi(restaurant.id, {
        coordinates: draftCoords,
        address: { street: draftStreet, area: draftArea, city: 'Mysuru' },
      });
      setRestaurants((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`Saved MongoDB GeoJSON coordinates for ${updated.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update location.');
    }
  };

  const openAddDish = () => {
    setEditingDish(null);
    setDishForm(EMPTY_DISH);
    setDishModalOpen(true);
  };

  const openEditDish = (dish) => {
    setEditingDish(dish);
    setDishForm({
      name: dish.name,
      description: dish.description || '',
      price: String(dish.price),
      category: dish.category,
      isVeg: dish.isVeg,
    });
    setDishModalOpen(true);
  };

  const handleSaveDish = async (e) => {
    e.preventDefault();
    if (!restaurant) return;
    setSavingDish(true);
    try {
      if (editingDish) {
        const updated = await updateFoodItemApi(editingDish.id, {
          ...dishForm,
          price: Number(dishForm.price),
        });
        setMenu((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        toast.success(`Updated ${updated.name}`);
      } else {
        const created = await createFoodItemApi({
          ...dishForm,
          restaurantId: restaurant.id,
          price: Number(dishForm.price),
        });
        setMenu((prev) => [created, ...prev]);
        toast.success(`Added ${created.name} to MongoDB menu`);
      }
      setDishModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save dish.');
    } finally {
      setSavingDish(false);
    }
  };

  const handleToggleDishAvail = async (dish) => {
    try {
      const updated = await toggleFoodAvailabilityApi(dish.id, !dish.availability);
      setMenu((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      toast.info(`${updated.name} marked ${updated.availability ? 'Available' : 'Sold Out'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update availability.');
    }
  };

  const handleDeleteDish = async (dish) => {
    try {
      await deleteFoodItemApi(dish.id);
      setMenu((prev) => prev.filter((m) => m.id !== dish.id));
      toast.info(`Deleted ${dish.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete dish.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Restaurant Kitchen Console"
      subtitle={restaurant ? `${restaurant.name} • ${restaurant.area}, Mysuru` : 'No kitchen linked'}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {!restaurant ? (
        <EmptyState
          icon={Store}
          title="No restaurant linked to this owner account"
          description="Sign in with a seeded restaurant owner account such as owner.mylari@bitestream.dev."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Kitchen:
              </label>
              <select
                value={restaurant.id}
                onChange={(e) => setSelectedRestId(e.target.value)}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-orange-500"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.area})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadRestaurantData}
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-stone-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={toggleSoundMute}
                title={soundMuted ? 'Unmute new order chimes' : 'Mute new order chimes'}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  soundMuted
                    ? 'border-stone-200 bg-stone-100 text-slate-500'
                    : 'border-orange-200 bg-orange-50 text-orange-800'
                }`}
              >
                {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {soundMuted ? 'Sound Muted' : 'Alerts On'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleOpen}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                restaurant.isOpen
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
              }`}
            >
              {restaurant.isOpen ? 'Accepting Orders (Open)' : 'Paused (Closed)'}
            </button>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active Kitchen Queue"
              value={incomingCount}
              hint="Placed, Accepted, Preparing"
              icon={Clock}
              accent="orange"
            />
            <StatCard
              label="Total Orders"
              value={orders.length}
              hint="MongoDB persisted orders"
              icon={ClipboardList}
              accent="sky"
            />
            <StatCard
              label="Food Revenue"
              value={formatINR(revenue)}
              hint="Excludes cancelled/rejected"
              icon={IndianRupee}
              accent="emerald"
            />
            <StatCard
              label="Menu Items"
              value={`${menu.filter((m) => m.availability).length}/${menu.length}`}
              hint="Available dishes"
              icon={UtensilsCrossed}
              accent="violet"
            />
          </div>

          {activeTab === 'orders' && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No orders for this kitchen yet"
                  description="Place a customer order from the storefront to manage it here."
                />
              ) : (
                orders.map((order) => {
                  const action = NEXT_STAGE_MAP[order.status];
                  return (
                    <div
                      key={order._id}
                      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-extrabold text-slate-900">
                              {order.orderNumber}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Customer:{' '}
                            <span className="font-semibold text-slate-700">
                              {order.customerId?.name || 'Customer'}
                            </span>{' '}
                            • {formatShortTime(order.createdAt)}
                          </p>
                        </div>
                        <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                          {formatINR(order.itemsTotal)}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <ul className="space-y-1 text-xs text-slate-700">
                          {order.items.map((item, idx) => (
                            <li key={idx}>
                              <span className="font-bold">{item.quantity}×</span> {item.name} —{' '}
                              <span className="tabular-nums">{formatINR(item.subtotal)}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="flex flex-wrap gap-2">
                          {(order.status === 'PLACED' || order.status === 'ACCEPTED') && (
                            <button
                              type="button"
                              onClick={() => handleTransition(order, 'REJECTED')}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Reject
                            </button>
                          )}
                          {action && (
                            <button
                              type="button"
                              onClick={() => handleTransition(order, action.next)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition ${action.btnClass}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {action.label}
                            </button>
                          )}
                          {order.status === 'READY_FOR_PICKUP' && !order.deliveryPartnerId && (
                            <button
                              type="button"
                              disabled={reassigningId === order._id}
                              onClick={() => handleRetryAssignment(order, false)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              {reassigningId === order._id ? 'Searching...' : 'Retry Auto-Assign'}
                            </button>
                          )}
                        </div>
                      </div>
                      {order.deliveryPartnerId ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-xs text-cyan-900">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Truck className="h-3.5 w-3.5 text-cyan-700" />
                            Rider: {order.deliveryPartnerId.name} ({order.deliveryPartnerId.vehicleNumber})
                          </span>
                          {order.status === 'READY_FOR_PICKUP' && (
                            <button
                              type="button"
                              disabled={reassigningId === order._id}
                              onClick={() => handleRetryAssignment(order, true)}
                              className="font-bold text-cyan-800 underline hover:text-cyan-950"
                            >
                              Reassign Rider
                            </button>
                          )}
                        </div>
                      ) : (
                        order.status === 'READY_FOR_PICKUP' && (
                          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            No rider assigned yet ({order.assignmentStatus || 'SEARCHING'}). Order is
                            live in the nearby delivery pool.
                          </div>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Menu Items ({menu.length})</h2>
                <button
                  type="button"
                  onClick={openAddDish}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Food Item
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {menu.map((dish) => (
                  <div
                    key={dish.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <VegIndicator isVeg={dish.isVeg} />
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {dish.category}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-sm font-bold text-slate-900">{dish.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{dish.description}</p>
                      </div>
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                        {formatINR(dish.price)}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleToggleDishAvail(dish)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          dish.availability
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {dish.availability ? 'Available' : 'Sold Out'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditDish(dish)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-stone-100 hover:text-slate-900"
                          aria-label={`Edit ${dish.name}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDish(dish)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${dish.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Kitchen Location &amp; GeoJSON Coordinates
                </h2>
                <p className="text-xs text-slate-500">
                  Updates MongoDB <code className="rounded bg-stone-100 px-1">2dsphere</code>{' '}
                  coordinates immediately
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Street</label>
                  <input
                    value={draftStreet}
                    onChange={(e) => setDraftStreet(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Area</label>
                  <input
                    value={draftArea}
                    onChange={(e) => setDraftArea(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex items-end sm:col-span-4">
                  <button
                    type="button"
                    onClick={handleSaveLocation}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
                  >
                    <Save className="h-4 w-4" />
                    Save Kitchen Location
                  </button>
                </div>
              </div>

              <LocationPickerMap
                coordinates={draftCoords}
                pinLabel={restaurant.name}
                variant="restaurant"
                showPresets={false}
                onChangeCoordinates={(coords) => setDraftCoords(coords)}
                heightClass="h-80"
              />
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={dishModalOpen}
        onClose={() => setDishModalOpen(false)}
        title={editingDish ? `Edit ${editingDish.name}` : 'Add New Menu Item'}
      >
        <form onSubmit={handleSaveDish} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Dish Name</label>
            <input
              required
              minLength={2}
              value={dishForm.name}
              onChange={(e) => setDishForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Description</label>
            <textarea
              rows={2}
              value={dishForm.description}
              onChange={(e) => setDishForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Price (₹)</label>
              <input
                type="number"
                min="1"
                required
                value={dishForm.price}
                onChange={(e) => setDishForm((p) => ({ ...p, price: e.target.value }))}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Category</label>
              <select
                value={dishForm.category}
                onChange={(e) => setDishForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
              >
                {MENU_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={dishForm.isVeg}
              onChange={(e) => setDishForm((p) => ({ ...p, isVeg: e.target.checked }))}
              className="h-4 w-4 rounded accent-emerald-600"
            />
            Vegetarian Dish
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDishModalOpen(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDish}
              className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {savingDish ? 'Saving...' : editingDish ? 'Save Changes' : 'Add Dish'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

export default function RestaurantDashboardPage() {
  return (
    <RoleAccessGate allowedRoles={['restaurant', 'admin']}>
      <RestaurantDashboardContent />
    </RoleAccessGate>
  );
}
