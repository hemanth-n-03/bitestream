import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  IndianRupee,
  Loader2,
  RefreshCw,
  Store,
  Truck,
  Users,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import RoleAccessGate from '../../components/common/RoleAccessGate';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';
import { RoleBadge, StatusBadge } from '../../components/common/Badge';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminOrdersApi,
  fetchAdminOverviewApi,
  fetchAdminPartnersApi,
  fetchAdminRestaurantsApi,
  fetchAdminUsersApi,
  toggleAdminRestaurantStatusApi,
  toggleAdminUserStatusApi,
} from '../../api/adminApi';
import { formatINR, formatShortTime } from '../../utils/formatters';

function AdminDashboardContent() {
  const { toast } = useToast();
  const { isConnected, reconnectNonce, subscribe } = useSocket();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);

  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderRestFilter, setOrderRestFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const overviewTimerRef = useRef(null);

  const refreshOverviewDebounced = useCallback(() => {
    if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current);
    overviewTimerRef.current = setTimeout(() => {
      fetchAdminOverviewApi()
        .then((ov) => setOverview(ov))
        .catch(() => {});
    }, 600);
  }, []);

  const loadAdminData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ovRes, ordRes, restRes, partRes, userRes] = await Promise.all([
        fetchAdminOverviewApi(),
        fetchAdminOrdersApi({
          ...(orderStatusFilter !== 'ALL' ? { status: orderStatusFilter } : {}),
          ...(orderRestFilter ? { restaurantId: orderRestFilter } : {}),
          ...(orderSearch.trim() ? { search: orderSearch.trim() } : {}),
          limit: 50,
        }),
        fetchAdminRestaurantsApi(),
        fetchAdminPartnersApi(),
        fetchAdminUsersApi(),
      ]);
      setOverview(ovRes);
      setOrders(ordRes.orders || []);
      setRestaurants(restRes);
      setPartners(partRes);
      setUsers(userRes);
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.message || 'Unable to load admin operations telemetry.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderStatusFilter, orderRestFilter, orderSearch, toast]);

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, orderRestFilter]);

  useEffect(() => {
    if (reconnectNonce > 0) {
      loadAdminData(true);
    }
  }, [reconnectNonce, loadAdminData]);

  // Fallback polling ONLY when Socket.IO is disconnected
  useEffect(() => {
    if (isConnected) return undefined;
    const timer = setInterval(() => {
      loadAdminData(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [isConnected, loadAdminData]);

  // Real-time MongoDB Change Stream -> Admin Socket.IO subscriptions
  useEffect(() => {
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
      (payload) => {
        const ord = payload?.order;
        if (!ord?._id) return;

        setOrders((prev) => {
          const matchesStatus = orderStatusFilter === 'ALL' || ord.status === orderStatusFilter;
          const ordRestId =
            typeof ord.restaurantId === 'object' ? ord.restaurantId._id : ord.restaurantId;
          const matchesRest = !orderRestFilter || ordRestId === orderRestFilter;
          const matchesSearch =
            !orderSearch.trim() ||
            ord.orderNumber?.toLowerCase().includes(orderSearch.trim().toLowerCase());

          const idx = prev.findIndex((o) => o._id === ord._id);
          if (!matchesStatus || !matchesRest || !matchesSearch) {
            return idx >= 0 ? prev.filter((o) => o._id !== ord._id) : prev;
          }
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = ord;
            return next;
          }
          return [ord, ...prev].slice(0, 50);
        });

        setSelectedOrder((curr) => (curr?._id === ord._id ? ord : curr));
        refreshOverviewDebounced();
      }
    );

    const unsubPartner = subscribe('DELIVERY_PARTNER_LOCATION_UPDATED', (payload) => {
      if (!payload?.partnerId) return;
      setPartners((prev) =>
        prev.map((p) =>
          p._id === payload.partnerId
            ? {
                ...p,
                availability: payload.availability || p.availability,
                totalDeliveries: payload.totalDeliveries ?? p.totalDeliveries,
                totalEarnings: payload.totalEarnings ?? p.totalEarnings,
                currentLocation: payload.coordinates
                  ? { type: 'Point', coordinates: payload.coordinates }
                  : p.currentLocation,
              }
            : p
        )
      );
      refreshOverviewDebounced();
    });

    const unsubRest = subscribe('RESTAURANT_STATUS_UPDATED', (payload) => {
      if (!payload?.restaurantId || !payload?.restaurant) return;
      setRestaurants((prev) =>
        prev.map((r) =>
          r._id === payload.restaurantId
            ? { ...r, isOpen: payload.restaurant.isOpen, isActive: payload.restaurant.isActive }
            : r
        )
      );
      refreshOverviewDebounced();
    });

    return () => {
      unsubOrders();
      unsubPartner();
      unsubRest();
      if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current);
    };
  }, [
    subscribe,
    orderStatusFilter,
    orderRestFilter,
    orderSearch,
    refreshOverviewDebounced,
  ]);

  const metrics = overview?.metrics || {
    totalUsers: 0,
    totalCustomers: 0,
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalPartners: 0,
    onlinePartners: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    grossRevenue: 0,
  };

  const navItems = [
    { id: 'overview', label: 'Analytics Overview', icon: BarChart3 },
    { id: 'orders', label: 'Orders Monitor', icon: ClipboardList, badge: metrics.activeOrders },
    { id: 'restaurants', label: 'Restaurants', icon: Store, badge: restaurants.length },
    { id: 'partners', label: 'Delivery Partners', icon: Truck, badge: partners.length },
    { id: 'users', label: 'Customers & Users', icon: Users, badge: users.length },
  ];

  const handleToggleRestaurant = async (rest) => {
    try {
      const updated = await toggleAdminRestaurantStatusApi(rest._id, !rest.isActive);
      setRestaurants((prev) => prev.map((r) => (r._id === rest._id ? { ...r, isActive: updated.isActive } : r)));
      toast.info(`${rest.name} ${updated.isActive ? 'activated' : 'suspended'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update restaurant status.');
    }
  };

  const handleToggleUser = async (user) => {
    try {
      const updated = await toggleAdminUserStatusApi(user._id, !user.isActive);
      setUsers((prev) => prev.map((u) => (u._id === user._id ? updated : u)));
      toast.info(`Updated access for ${user.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  return (
    <DashboardLayout
      title="Admin Operations Center"
      subtitle="Live MongoDB telemetry, order monitoring, and multi-role governance"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => loadAdminData(false)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Telemetry
        </button>
      </div>

      {loading && !overview ? (
        <div className="flex min-h-[45vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Gross Platform Revenue"
              value={formatINR(metrics.grossRevenue)}
              hint={`Avg Order ${formatINR(metrics.avgOrderValue || 0)} • Non-cancelled`}
              icon={IndianRupee}
              accent="emerald"
            />
            <StatCard
              label="Total Orders"
              value={metrics.totalOrders}
              hint={`${metrics.activeOrders} active • ${metrics.completedOrders} delivered (${
                metrics.completionRatePct ?? 0
              }%)`}
              icon={ClipboardList}
              accent="orange"
            />
            <StatCard
              label="Mysuru Restaurants"
              value={`${metrics.activeRestaurants}/${metrics.totalRestaurants}`}
              hint="Active partner kitchens"
              icon={Store}
              accent="sky"
            />
            <StatCard
              label="Delivery Fleet & Users"
              value={`${metrics.totalPartners} Riders • ${metrics.totalCustomers} Cust`}
              hint={`${metrics.onlinePartners} riders online/busy`}
              icon={Users}
              accent="violet"
            />
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Activity className="h-4 w-4 text-orange-600" />
                      Daily Order &amp; Revenue Trend (MongoDB Aggregation)
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {overview?.analytics?.dailyTrend?.length || 0} day(s) recorded
                    </span>
                  </div>

                  {overview?.analytics?.dailyTrend?.length > 0 ? (
                    (() => {
                      const days = overview.analytics.dailyTrend;
                      const maxRev = Math.max(...days.map((d) => d.revenue || 0), 1);
                      return (
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-6">
                          {days.map((day) => {
                            const heightPct = Math.max(
                              12,
                              Math.round(((day.revenue || 0) / maxRev) * 100)
                            );
                            return (
                              <div
                                key={day.date}
                                className="flex flex-col justify-end rounded-xl border border-stone-100 bg-stone-50/70 p-3"
                              >
                                <div className="flex h-28 items-end justify-center pb-2">
                                  <div
                                    className="w-8 rounded-t-lg bg-gradient-to-t from-orange-600 to-amber-400 transition-all"
                                    style={{ height: `${heightPct}%` }}
                                    title={`${day.date}: ${day.orders} orders (${formatINR(
                                      day.revenue
                                    )})`}
                                  />
                                </div>
                                <p className="text-center text-xs font-extrabold text-slate-900 tabular-nums">
                                  {formatINR(day.revenue)}
                                </p>
                                <p className="text-center text-[10px] font-semibold text-slate-500">
                                  {day.orders} ord • {day.date.slice(5)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mt-4 space-y-3">
                      {[
                        { label: 'Active In-Flight Orders', count: metrics.activeOrders, color: 'bg-orange-500' },
                        { label: 'Delivered Successfully', count: metrics.completedOrders, color: 'bg-emerald-500' },
                        { label: 'Cancelled / Rejected', count: metrics.cancelledOrders, color: 'bg-rose-500' },
                      ].map((row) => {
                        const pct = metrics.totalOrders
                          ? Math.round((row.count / metrics.totalOrders) * 100)
                          : 0;
                        return (
                          <div key={row.label}>
                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                              <span>{row.label}</span>
                              <span className="tabular-nums">
                                {row.count} ({pct}%)
                              </span>
                            </div>
                            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100">
                              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Lifecycle Ratio Strip */}
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-xs">
                    <div className="rounded-xl bg-orange-50 px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase text-orange-700">
                        Active Queue
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                        {metrics.activeOrders}
                      </span>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase text-emerald-700">
                        Delivered
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                        {metrics.completedOrders}
                      </span>
                    </div>
                    <div className="rounded-xl bg-rose-50 px-3 py-2">
                      <span className="block text-[10px] font-bold uppercase text-rose-700">
                        Cancelled/Rejected
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                        {metrics.cancelledOrders}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5">
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    MongoDB Collections &amp; Payment State
                  </h2>
                  <div className="mt-4 space-y-2 text-xs">
                    {Object.entries(overview?.collections || {}).map(([name, count]) => (
                      <div
                        key={name}
                        className="flex justify-between rounded-xl bg-stone-50 px-3 py-2"
                      >
                        <span className="font-mono font-semibold text-slate-600">{name}</span>
                        <span className="font-bold text-slate-900 tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>

                  {overview?.analytics?.paymentBreakdown?.length > 0 && (
                    <div className="mt-4 border-t border-stone-100 pt-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        COD Payment Ledger
                      </p>
                      <div className="space-y-1.5 text-xs">
                        {overview.analytics.paymentBreakdown.map((p, idx) => (
                          <div
                            key={`${p.method}-${p.status}-${idx}`}
                            className="flex items-center justify-between rounded-lg bg-stone-50 px-2.5 py-1.5"
                          >
                            <span className="font-semibold text-slate-700">
                              {p.method} • {p.status}
                            </span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {p.count} ({formatINR(p.amount)})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Top Kitchens & Top Dishes from MongoDB Aggregation */}
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7">
                  <h2 className="text-base font-bold text-slate-900">
                    Top Mysuru Kitchens by Revenue
                  </h2>
                  {overview?.analytics?.restaurantPerformance?.length > 0 ? (
                    (() => {
                      const list = overview.analytics.restaurantPerformance;
                      const maxRev = Math.max(...list.map((r) => r.revenue || 0), 1);
                      return (
                        <div className="mt-4 space-y-3">
                          {list.map((item) => {
                            const pct = Math.max(8, Math.round((item.revenue / maxRev) * 100));
                            return (
                              <div key={item.restaurantId}>
                                <div className="flex items-center justify-between text-xs">
                                  <div>
                                    <span className="font-bold text-slate-900">{item.name}</span>
                                    <span className="ml-2 text-slate-400">({item.area})</span>
                                  </div>
                                  <span className="font-extrabold text-slate-900 tabular-nums">
                                    {formatINR(item.revenue)} • {item.orderCount} ord
                                  </span>
                                </div>
                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      Place or seed demo orders to inspect live per-kitchen revenue analytics.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5">
                  <h2 className="text-base font-bold text-slate-900">Most Ordered Dishes</h2>
                  {overview?.analytics?.topDishes?.length > 0 ? (
                    <div className="mt-4 space-y-2.5 text-xs">
                      {overview.analytics.topDishes.map((dish, idx) => (
                        <div
                          key={dish.name}
                          className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-bold text-slate-900">
                              {idx + 1}. {dish.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {dish.unitsSold} units across {dish.ordersCount} orders
                            </p>
                          </div>
                          <span className="shrink-0 font-extrabold text-orange-700 tabular-nums">
                            {formatINR(dish.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      Dish order aggregation populates automatically from MongoDB orders.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PLACED">PLACED</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="PREPARING">PREPARING</option>
                  <option value="READY_FOR_PICKUP">READY_FOR_PICKUP</option>
                  <option value="PICKED_UP">PICKED_UP</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>

                <select
                  value={orderRestFilter}
                  onChange={(e) => setOrderRestFilter(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="">All Restaurants</option>
                  {restaurants.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Order # (e.g. BS-)"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-orange-500"
                />

                <button
                  type="button"
                  onClick={loadAdminData}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
                >
                  Apply
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 bg-stone-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-bold">Order</th>
                      <th className="px-4 py-3 font-bold">Customer</th>
                      <th className="px-4 py-3 font-bold">Restaurant</th>
                      <th className="px-4 py-3 font-bold">Rider</th>
                      <th className="px-4 py-3 font-bold">Amount</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Placed</th>
                      <th className="px-4 py-3 font-bold">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.map((o) => (
                      <tr key={o._id} className="hover:bg-stone-50/70">
                        <td className="px-4 py-3 font-bold text-slate-900">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{o.customerId?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{o.restaurantId?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {o.deliveryPartnerId?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">
                          {formatINR(o.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatShortTime(o.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-stone-100"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'restaurants' && (
            <div className="grid gap-4 md:grid-cols-2">
              {restaurants.map((rest) => (
                <div
                  key={rest._id}
                  className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{rest.name}</p>
                    <p className="text-xs text-slate-500">
                      {rest.address?.area} • Rating {(rest.rating?.average ?? 4.5).toFixed(1)} ★
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      GeoJSON: [{rest.location?.coordinates?.join(', ')}]
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleRestaurant(rest)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                      rest.isActive
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                    }`}
                  >
                    {rest.isActive ? 'Active' : 'Suspended'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'partners' && (
            <div className="grid gap-4 md:grid-cols-3">
              {partners.map((dp) => (
                <div key={dp._id} className="rounded-2xl border border-stone-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">{dp.name}</p>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                      {dp.availability}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {dp.vehicleType} • {dp.vehicleNumber}
                  </p>
                  <div className="mt-4 flex justify-between border-t border-stone-100 pt-3 text-xs">
                    <span>{dp.totalDeliveries} trips</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      {formatINR(dp.totalEarnings)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 bg-stone-50 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-bold">Name</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Phone</th>
                    <th className="px-4 py-3 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleUser(u)}
                          className={`rounded-lg px-2.5 py-1 font-bold ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {u.isActive ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details: ${selectedOrder?.orderNumber || ''}`}
        maxWidth="max-w-lg"
      >
        {selectedOrder && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedOrder.status} />
              <span className="font-bold text-slate-900 tabular-nums">
                Total: {formatINR(selectedOrder.totalAmount)} ({selectedOrder.paymentStatus})
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-700">Items:</p>
              <ul className="mt-1 space-y-1">
                {selectedOrder.items.map((it, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>
                      {it.quantity}× {it.name}
                    </span>
                    <span>{formatINR(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-700">Status History:</p>
              <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                {(selectedOrder.statusHistory || []).map((h, idx) => (
                  <li key={idx}>
                    <strong>{h.status}</strong> — {h.note} ({formatShortTime(h.timestamp)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

export default function AdminDashboardPage() {
  return (
    <RoleAccessGate allowedRoles={['admin']}>
      <AdminDashboardContent />
    </RoleAccessGate>
  );
}
