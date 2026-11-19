import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react';
import { cancelOrderApi, fetchMyOrdersApi } from '../../api/orderApi';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { formatINR, formatShortTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/Badge';
import RoleAccessGate from '../../components/common/RoleAccessGate';
import OrderTimeline from '../../components/customer/OrderTimeline';
import LiveTrackingMap from '../../components/maps/LiveTrackingMap';
import EmptyState from '../../components/common/EmptyState';

const CANCELLABLE_STATUSES = ['PLACED', 'ACCEPTED'];

function formatDeliveryAddr(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.label, addr.street, addr.area, addr.city].filter(Boolean).join(', ');
}

function OrdersContent() {
  const { toast } = useToast();
  const { isConnected, connectionStatus, reconnectNonce, subscribe } = useSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedMapId, setExpandedMapId] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchMyOrdersApi({
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        limit: 30,
      });
      setOrders(res.orders || []);
      if (res.orders?.length) {
        const firstActive = res.orders.find(
          (o) => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)
        );
        if (firstActive) {
          setExpandedMapId((curr) => curr || firstActive._id);
        }
      }
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.message || 'Unable to load orders.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Catch-up sync whenever Socket.IO reconnects after an interruption
  useEffect(() => {
    if (reconnectNonce > 0) {
      loadOrders(true);
    }
  }, [reconnectNonce, loadOrders]);

  // Fallback polling ONLY when Socket.IO is disconnected
  useEffect(() => {
    if (isConnected) return undefined;
    const timer = setInterval(() => {
      loadOrders(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [isConnected, loadOrders]);

  // Real-time MongoDB Change Stream -> Socket.IO listeners
  useEffect(() => {
    const upsertOrder = (incoming) => {
      if (!incoming?._id) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === incoming._id);
        const matchesFilter = statusFilter === 'ALL' || incoming.status === statusFilter;

        if (!matchesFilter) {
          return idx >= 0 ? prev.filter((o) => o._id !== incoming._id) : prev;
        }
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = incoming;
          return next;
        }
        return [incoming, ...prev];
      });
    };

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
        if (payload?.order) {
          upsertOrder(payload.order);
          if (eventName === 'ORDER_CREATED') {
            setExpandedMapId((curr) => curr || payload.order._id);
          } else if (eventName === 'DELIVERY_COMPLETED') {
            toast.success(`Order ${payload.order.orderNumber} delivered! Enjoy your meal.`);
          }
        }
      }
    );

    const unsubLocation = subscribe('DELIVERY_PARTNER_LOCATION_UPDATED', (payload) => {
      if (!payload?.coordinates || !payload?.partnerId) return;
      setOrders((prev) =>
        prev.map((o) => {
          const matchesPartner = o.deliveryPartnerId?._id === payload.partnerId;
          const matchesOrder = payload.orderId && o._id === payload.orderId;
          if (!matchesPartner && !matchesOrder) return o;
          return {
            ...o,
            deliveryPartnerId: o.deliveryPartnerId
              ? {
                  ...o.deliveryPartnerId,
                  currentLocation: { type: 'Point', coordinates: payload.coordinates },
                }
              : o.deliveryPartnerId,
          };
        })
      );
    });

    return () => {
      unsubOrders();
      unsubLocation();
    };
  }, [subscribe, statusFilter, toast]);

  const handleCancel = async (order) => {
    setBusyOrderId(order._id);
    try {
      const updated = await cancelOrderApi(order._id, 'Cancelled by customer');
      setOrders((prev) => prev.map((o) => (o._id === order._id ? updated : o)));
      toast.info(`Order ${order.orderNumber} was cancelled.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel order.');
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900">Your Orders &amp; History</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                isConnected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isConnected
                ? 'Live Change Streams'
                : connectionStatus === 'reconnecting'
                ? 'Reconnecting (Fallback Sync)'
                : 'Fallback Polling Active'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Real-time MongoDB order timeline, rider assignment &amp; live GPS tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadOrders(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/"
            className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700"
          >
            Order Food
          </Link>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { id: 'ALL', label: 'All Orders' },
          { id: 'PLACED', label: 'Placed' },
          { id: 'PREPARING', label: 'Preparing' },
          { id: 'OUT_FOR_DELIVERY', label: 'On the Way' },
          { id: 'DELIVERED', label: 'Delivered' },
          { id: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === tab.id
                ? 'bg-slate-900 text-white'
                : 'border border-stone-200 bg-white text-slate-600 hover:bg-stone-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Package}
            title="No orders found"
            description="Browse Mysuru kitchens, add dishes to your basket, and place a Cash on Delivery order."
            action={
              <Link
                to="/"
                className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white"
              >
                Explore Restaurants
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {orders.map((order) => {
            const canCancel = CANCELLABLE_STATUSES.includes(order.status);
            const restaurant = order.restaurantId;
            const partner = order.deliveryPartnerId;
            const isMapOpen = expandedMapId === order._id;
            const isHistoryOpen = expandedHistoryId === order._id;
            const addrText = formatDeliveryAddr(order.deliveryAddress);

            return (
              <div
                key={order._id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-base font-extrabold text-slate-900">
                        {restaurant?.name || 'Mysuru Kitchen'}
                      </span>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {order.orderNumber}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-orange-500" />
                      {addrText} • {formatShortTime(order.createdAt)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                      {formatINR(order.totalAmount)}
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-700">
                      Payment: {order.paymentStatus} (COD)
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <OrderTimeline status={order.status} />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-12">
                  <div className="rounded-xl bg-stone-50 p-3.5 md:col-span-7">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Order Items
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>
                            <span className="font-bold">{item.quantity}×</span> {item.name}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatINR(item.subtotal || item.price * item.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2.5 flex justify-between border-t border-stone-200 pt-2 text-[11px] text-slate-500">
                      <span>
                        Subtotal {formatINR(order.itemsTotal)} • Delivery{' '}
                        {order.deliveryFee === 0 ? 'FREE' : formatINR(order.deliveryFee)} • Tax{' '}
                        {formatINR(order.taxAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-stone-200 p-3.5 md:col-span-5">
                    {partner ? (
                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <Truck className="h-3.5 w-3.5 text-cyan-600" />
                          Delivery Partner Assigned
                        </p>
                        <p className="mt-1.5 text-sm font-bold text-slate-900">{partner.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="h-3 w-3" />
                          {partner.phone} • {partner.vehicleNumber}
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">Delivery Partner Status</p>
                        <p className="mt-1">
                          {order.status === 'CANCELLED' || order.status === 'REJECTED'
                            ? 'Order closed prior to rider pickup.'
                            : 'A rider will accept this order once the kitchen marks it Ready for Pickup.'}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {restaurant?.location?.coordinates && order.deliveryLocation?.coordinates && (
                        <button
                          type="button"
                          onClick={() => setExpandedMapId(isMapOpen ? null : order._id)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-600"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          {isMapOpen ? 'Hide Map' : 'Route Map'}
                          {isMapOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isHistoryOpen ? null : order._id)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Log
                      </button>

                      {canCancel && (
                        <button
                          type="button"
                          disabled={busyOrderId === order._id}
                          onClick={() => handleCancel(order)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status History Audit Log */}
                {isHistoryOpen && Array.isArray(order.statusHistory) && (
                  <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Order Status History
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs">
                      {order.statusHistory.map((h, i) => (
                        <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <strong className="text-slate-900">{h.status}</strong> —{' '}
                            <span className="text-slate-600">{h.note}</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatShortTime(h.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Leaflet Route Map */}
                {isMapOpen &&
                  restaurant?.location?.coordinates &&
                  order.deliveryLocation?.coordinates && (
                    <div className="mt-4 border-t border-stone-100 pt-4">
                      <LiveTrackingMap
                        restaurantCoords={restaurant.location.coordinates}
                        restaurantName={restaurant.name}
                        customerCoords={order.deliveryLocation.coordinates}
                        customerLabel={addrText}
                        partnerCoords={partner?.currentLocation?.coordinates}
                        partnerName={partner?.name}
                        deliveryStatus={order.status}
                      />
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RoleAccessGate allowedRoles={['customer', 'admin']}>
      <OrdersContent />
    </RoleAccessGate>
  );
}
