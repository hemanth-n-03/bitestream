import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Crosshair,
  History,
  IndianRupee,
  Loader2,
  MapPin,
  Navigation,
  Power,
  Radio,
  RefreshCw,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import RoleAccessGate from '../../components/common/RoleAccessGate';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import LiveTrackingMap from '../../components/maps/LiveTrackingMap';
import { StatusBadge } from '../../components/common/Badge';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  acceptDeliveryTaskApi,
  confirmDeliveryTaskApi,
  fetchAvailableTasksApi,
  fetchDeliveryHistoryApi,
  fetchPartnerMeApi,
  rejectDeliveryTaskApi,
  togglePartnerAvailabilityApi,
  updatePartnerLocationApi,
} from '../../api/deliveryApi';
import { updateOrderStatusApi } from '../../api/orderApi';
import { formatDistanceKm, formatINR, formatShortTime } from '../../utils/formatters';

function formatAddr(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.street, addr.area, addr.city].filter(Boolean).join(', ');
}

function DeliveryDashboardContent() {
  const { toast } = useToast();
  const { isConnected, reconnectNonce, subscribe, emitLocationUpdate } = useSocket();
  const { loading: gpsLoading, error: gpsError, requestLocation } = useGeolocation();

  const [activeTab, setActiveTab] = useState('dispatch');
  const [partner, setPartner] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamingGps, setStreamingGps] = useState(false);

  const lastStreamEmitRef = useRef(0);
  const partnerIdRef = useRef(null);

  useEffect(() => {
    partnerIdRef.current = partner?._id || null;
  }, [partner?._id]);

  const loadDeliveryData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [me, available, histRes] = await Promise.all([
        fetchPartnerMeApi(),
        fetchAvailableTasksApi(),
        fetchDeliveryHistoryApi(),
      ]);
      setPartner(me);
      setTasks(available);
      setHistory(histRes.orders || []);
    } catch (err) {
      if (!silent) {
        toast.error(err.response?.data?.message || 'Failed to load delivery partner console.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDeliveryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reconnectNonce > 0) {
      loadDeliveryData(true);
    }
  }, [reconnectNonce, loadDeliveryData]);

  // Fallback polling ONLY when Socket.IO is disconnected
  useEffect(() => {
    if (isConnected) return undefined;
    const timer = setInterval(() => {
      loadDeliveryData(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [isConnected, loadDeliveryData]);

  // Real-time MongoDB Change Stream -> Socket.IO listeners
  useEffect(() => {
    const unsubAssigned = subscribe('DELIVERY_ASSIGNED', (payload) => {
      const assignedOrder = payload?.order;
      if (!assignedOrder?._id) return;

      const assignedPartnerId =
        payload?.partner?._id || assignedOrder.deliveryPartnerId?._id || assignedOrder.deliveryPartnerId;

      if (partnerIdRef.current && assignedPartnerId === partnerIdRef.current) {
        setPartner((prev) =>
          prev ? { ...prev, availability: 'BUSY', activeOrderId: assignedOrder } : prev
        );
        setTasks((prev) => prev.filter((t) => t._id !== assignedOrder._id));
        toast.success(`New delivery task assigned: ${assignedOrder.orderNumber}`);
      } else {
        setTasks((prev) => prev.filter((t) => t._id !== assignedOrder._id));
      }
    });

    const unsubOrderUpdates = subscribe(
      [
        'ORDER_STATUS_UPDATED',
        'DELIVERY_PICKED_UP',
        'DELIVERY_COMPLETED',
        'ORDER_CANCELLED',
        'ORDER_REJECTED',
      ],
      (payload) => {
        const ord = payload?.order;
        if (!ord?._id) return;

        if (ord.status === 'READY_FOR_PICKUP' && !ord.deliveryPartnerId) {
          fetchAvailableTasksApi()
            .then((available) => setTasks(available))
            .catch(() => {});
        } else if (['CANCELLED', 'REJECTED', 'DELIVERED'].includes(ord.status)) {
          setTasks((prev) => prev.filter((t) => t._id !== ord._id));
        }

        setPartner((prev) => {
          if (!prev?.activeOrderId || prev.activeOrderId._id !== ord._id) return prev;
          if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(ord.status)) {
            loadDeliveryData(true);
            return { ...prev, activeOrderId: null, availability: 'ONLINE' };
          }
          return { ...prev, activeOrderId: ord };
        });
      }
    );

    const unsubLocation = subscribe('DELIVERY_PARTNER_LOCATION_UPDATED', (payload) => {
      if (!payload?.partnerId || payload.partnerId !== partnerIdRef.current) return;
      setPartner((prev) =>
        prev
          ? {
              ...prev,
              availability: payload.availability || prev.availability,
              totalDeliveries: payload.totalDeliveries ?? prev.totalDeliveries,
              totalEarnings: payload.totalEarnings ?? prev.totalEarnings,
              currentLocation: payload.coordinates
                ? { type: 'Point', coordinates: payload.coordinates }
                : prev.currentLocation,
            }
          : prev
      );
    });

    return () => {
      unsubAssigned();
      unsubOrderUpdates();
      unsubLocation();
    };
  }, [subscribe, loadDeliveryData, toast]);

  // Throttled live browser GPS watchPosition over Socket.IO (5000ms interval)
  useEffect(() => {
    if (!streamingGps) return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Browser geolocation is unavailable on this device.');
      setStreamingGps(false);
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastStreamEmitRef.current < 5000) return;
        lastStreamEmitRef.current = now;

        const coords = [
          Number(pos.coords.longitude.toFixed(6)),
          Number(pos.coords.latitude.toFixed(6)),
        ];

        const sent = emitLocationUpdate(coords, (ack) => {
          if (ack?.persisted) {
            setPartner((prev) =>
              prev
                ? {
                    ...prev,
                    currentLocation: { type: 'Point', coordinates: ack.coordinates || coords },
                  }
                : prev
            );
          }
        });
        if (!sent) {
          updatePartnerLocationApi(coords).catch(() => {});
        }
      },
      (err) => {
        toast.error(err.message || 'GPS stream interrupted.');
        setStreamingGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [streamingGps, emitLocationUpdate, toast]);

  const handleToggleAvailability = async () => {
    if (!partner) return;
    try {
      const next = partner.availability === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
      const updated = await togglePartnerAvailabilityApi(next);
      setPartner((prev) => ({ ...prev, availability: updated.availability }));
      toast.info(`Rider status set to ${updated.availability}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to change availability.');
    }
  };

  const handleSyncGps = () => {
    requestLocation(async (coords) => {
      try {
        const updated = await updatePartnerLocationApi(coords);
        setPartner((prev) => ({ ...prev, currentLocation: updated.currentLocation }));
        toast.success(`GPS location persisted: [${coords[0]}, ${coords[1]}]`);
        loadDeliveryData();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Unable to update GPS location.');
      }
    });
  };

  const handleAcceptTask = async (orderId) => {
    try {
      const assigned = await acceptDeliveryTaskApi(orderId);
      toast.success(`Accepted ${assigned.orderNumber}`);
      await loadDeliveryData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not accept task.');
    }
  };

  const handleConfirmAssigned = async (orderId) => {
    try {
      const updated = await confirmDeliveryTaskApi(orderId);
      setPartner((prev) => (prev ? { ...prev, activeOrderId: updated } : prev));
      toast.success(`Confirmed assignment for ${updated.orderNumber}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm task.');
    }
  };

  const handleDeclineAssigned = async (orderId) => {
    try {
      const res = await rejectDeliveryTaskApi(orderId, 'Declined by delivery partner');
      toast.info(
        res.reassignment?.assigned
          ? `Declined — reassigned to ${res.reassignment.partnerName}`
          : 'Assignment declined; returned to nearby delivery pool.'
      );
      await loadDeliveryData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not decline assignment.');
    }
  };

  const handleAdvanceOrder = async (orderId, nextStatus) => {
    try {
      const updated = await updateOrderStatusApi(orderId, { status: nextStatus });
      toast.success(`Order ${updated.orderNumber} → ${nextStatus}`);
      await loadDeliveryData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update delivery status.');
    }
  };

  const activeOrder = partner?.activeOrderId || null;

  const previewTarget = activeOrder
    ? {
        restaurantCoords: activeOrder.restaurantId?.location?.coordinates,
        restaurantName: activeOrder.restaurantId?.name,
        customerCoords: activeOrder.deliveryLocation?.coordinates,
        customerLabel: formatAddr(activeOrder.deliveryAddress),
      }
    : tasks[0]?.restaurantId?.location?.coordinates
    ? {
        restaurantCoords: tasks[0].restaurantId.location.coordinates,
        restaurantName: tasks[0].restaurantId.name,
        customerCoords: tasks[0].deliveryLocation?.coordinates,
        customerLabel: formatAddr(tasks[0].deliveryAddress),
      }
    : null;

  const navItems = [
    { id: 'dispatch', label: 'Dispatch & Navigation', icon: Truck, badge: tasks.length },
    { id: 'history', label: 'History & Earnings', icon: History, badge: history.length },
  ];

  if (loading && !partner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Delivery Partner Console"
      subtitle={partner ? `${partner.name} • ${partner.vehicleType} (${partner.vehicleNumber})` : ''}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {partner && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSyncGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60"
              >
                {gpsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Crosshair className="h-3.5 w-3.5" />
                )}
                Sync Browser GPS
              </button>
              <button
                type="button"
                onClick={() => setStreamingGps((s) => !s)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  streamingGps
                    ? 'border-emerald-300 bg-emerald-600 text-white'
                    : 'border-stone-200 bg-white text-slate-700 hover:bg-stone-50'
                }`}
              >
                <Radio className={`h-3.5 w-3.5 ${streamingGps ? 'animate-pulse' : ''}`} />
                {streamingGps ? 'Live GPS Stream On (5s)' : 'Start GPS Stream'}
              </button>
              <button
                type="button"
                onClick={() => loadDeliveryData(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            <button
              type="button"
              disabled={partner.availability === 'BUSY'}
              onClick={handleToggleAvailability}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
                partner.availability === 'ONLINE'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : partner.availability === 'BUSY'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              Status: {partner.availability}
            </button>
          </div>

          {gpsError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
              {gpsError}
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Earnings"
              value={formatINR(partner.totalEarnings)}
              hint="Cumulative payouts"
              icon={IndianRupee}
              accent="emerald"
            />
            <StatCard
              label="Completed Trips"
              value={partner.totalDeliveries}
              hint="MongoDB verified count"
              icon={CheckCircle2}
              accent="sky"
            />
            <StatCard
              label="Rider Rating"
              value={`${(partner.rating ?? 4.8).toFixed(1)} ★`}
              hint="Customer feedback"
              icon={Star}
              accent="orange"
            />
            <StatCard
              label="Current GPS [lng, lat]"
              value={`${partner.currentLocation.coordinates[0].toFixed(3)}, ${partner.currentLocation.coordinates[1].toFixed(3)}`}
              hint="GeoJSON Point"
              icon={MapPin}
              accent="violet"
            />
          </div>

          {activeTab === 'dispatch' && (
            <div className="space-y-6">
              {previewTarget && previewTarget.restaurantCoords && previewTarget.customerCoords && (
                <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                  <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
                    <Navigation className="h-4 w-4 text-cyan-600" />
                    {activeOrder
                      ? `Active Route: ${activeOrder.orderNumber}`
                      : `Nearest Pickup Preview: ${tasks[0]?.orderNumber}`}
                  </h2>
                  <LiveTrackingMap
                    restaurantCoords={previewTarget.restaurantCoords}
                    restaurantName={previewTarget.restaurantName}
                    customerCoords={previewTarget.customerCoords}
                    customerLabel={previewTarget.customerLabel}
                    partnerCoords={partner.currentLocation.coordinates}
                    partnerName={partner.name}
                    deliveryStatus={activeOrder?.status || null}
                    heightClass="h-72 sm:h-80"
                  />
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  <h2 className="mb-3 text-base font-bold text-slate-900">Active Delivery Trip</h2>
                  {!activeOrder ? (
                    <EmptyState
                      icon={Truck}
                      title="No active delivery"
                      description="Go ONLINE and accept an eligible Ready-for-Pickup order from the queue."
                    />
                  ) : (
                    <div className="space-y-4 rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-base font-extrabold text-slate-900">
                            {activeOrder.orderNumber}
                          </span>
                          <p className="text-xs text-slate-500">
                            {activeOrder.restaurantId?.name}
                          </p>
                        </div>
                        <StatusBadge status={activeOrder.status} />
                      </div>

                      <div className="space-y-2 rounded-xl bg-stone-50 p-3.5 text-xs">
                        <p className="font-semibold text-slate-700">
                          <span className="text-slate-400">Customer:</span>{' '}
                          {activeOrder.customerId?.name} ({activeOrder.customerId?.phone})
                        </p>
                        <p className="flex items-start gap-1.5 text-slate-700">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                          {formatAddr(activeOrder.deliveryAddress)}
                        </p>
                        <p className="font-bold text-slate-900">
                          Collect COD: {formatINR(activeOrder.totalAmount)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {activeOrder.status === 'READY_FOR_PICKUP' && (
                          <>
                            {activeOrder.assignmentStatus === 'ASSIGNED' && (
                              <button
                                type="button"
                                onClick={() => handleConfirmAssigned(activeOrder._id)}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                              >
                                Confirm Assignment
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAdvanceOrder(activeOrder._id, 'PICKED_UP')}
                              className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white hover:bg-cyan-700"
                            >
                              Mark Picked Up from Kitchen
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineAssigned(activeOrder._id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Decline
                            </button>
                          </>
                        )}
                        {activeOrder.status === 'PICKED_UP' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceOrder(activeOrder._id, 'OUT_FOR_DELIVERY')}
                            className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
                          >
                            Start Navigation (Out for Delivery)
                          </button>
                        )}
                        {activeOrder.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceOrder(activeOrder._id, 'DELIVERED')}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Confirm Delivered (Mark COD Paid)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6">
                  <h2 className="mb-3 text-base font-bold text-slate-900">
                    Eligible Ready Pickups ({tasks.length})
                  </h2>
                  {tasks.length === 0 ? (
                    <EmptyState
                      icon={MapPin}
                      title="No unassigned pickups available"
                      description="When a kitchen marks an order Ready for Pickup, it appears here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((req) => (
                        <div
                          key={req._id}
                          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{req.orderNumber}</span>
                                <span className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                                  {formatDistanceKm(req.pickupDistanceKm)} away
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-slate-700">
                                Pickup: {req.restaurantId?.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                Drop: {formatAddr(req.deliveryAddress)}
                              </p>
                            </div>
                            <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                              +₹55
                            </span>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              disabled={partner.availability !== 'ONLINE'}
                              onClick={() => handleAcceptTask(req._id)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {partner.availability === 'ONLINE'
                                ? 'Accept Pickup Task'
                                : 'Must be ONLINE'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No completed trips yet"
                  description="Complete a delivery trip to see payout history here."
                />
              ) : (
                history.map((ord) => (
                  <div
                    key={ord._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {ord.orderNumber} • {ord.restaurantId?.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatAddr(ord.deliveryAddress)} • {formatShortTime(ord.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={ord.status} />
                      <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                        +₹55
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

export default function DeliveryDashboardPage() {
  return (
    <RoleAccessGate allowedRoles={['delivery']}>
      <DeliveryDashboardContent />
    </RoleAccessGate>
  );
}
