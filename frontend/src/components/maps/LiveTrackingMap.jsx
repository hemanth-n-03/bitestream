import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { calculateRouteMetrics, toLatLng } from '../../utils/geo';
import { formatDistanceKm } from '../../utils/formatters';
import {
  MapViewportController,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  createRestaurantPinIcon,
  customerPinIcon,
  riderPinIcon,
} from './MapPrimitives';

export default function LiveTrackingMap({
  restaurantCoords,
  restaurantName = 'Pickup Kitchen',
  customerCoords,
  customerLabel = 'Customer Drop',
  partnerCoords,
  partnerName = 'Delivery Partner',
  deliveryStatus = null,
  heightClass = 'h-64 sm:h-72',
}) {
  const restLatLng = useMemo(() => toLatLng(restaurantCoords), [restaurantCoords]);
  const custLatLng = useMemo(() => toLatLng(customerCoords), [customerCoords]);
  const partnerLatLng = useMemo(
    () => (partnerCoords ? toLatLng(partnerCoords) : null),
    [partnerCoords]
  );

  const metrics = useMemo(
    () =>
      calculateRouteMetrics({
        restaurantCoords,
        customerCoords,
        partnerCoords,
      }),
    [restaurantCoords, customerCoords, partnerCoords]
  );

  const bounds = useMemo(() => {
    const pts = [restLatLng, custLatLng];
    if (partnerLatLng) pts.push(partnerLatLng);
    return pts;
  }, [restLatLng, custLatLng, partnerLatLng]);

  // Refit only when pickup/drop points change or when a rider is first assigned/unassigned
  const fitKey = useMemo(
    () =>
      `${restLatLng[0]},${restLatLng[1]}|${custLatLng[0]},${custLatLng[1]}|${Boolean(
        partnerLatLng
      )}`,
    [restLatLng, custLatLng, partnerLatLng]
  );

  const routeLine = useMemo(() => {
    if (partnerLatLng) return [restLatLng, partnerLatLng, custLatLng];
    return [restLatLng, custLatLng];
  }, [restLatLng, partnerLatLng, custLatLng]);

  return (
    <div className="space-y-2.5">
      {/* Distance Telemetry Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400">
            Kitchen → Customer
          </span>
          <span className="font-extrabold text-slate-900 tabular-nums">
            {formatDistanceKm(metrics.restaurantToCustomerKm)}
          </span>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400">
            Rider → Kitchen
          </span>
          <span className="font-extrabold text-cyan-700 tabular-nums">
            {metrics.partnerToRestaurantKm != null
              ? formatDistanceKm(metrics.partnerToRestaurantKm)
              : 'Pending Rider'}
          </span>
        </div>
        <div className="col-span-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs sm:col-span-1">
          <span className="block text-[10px] font-bold uppercase text-slate-400">
            {deliveryStatus ? `Rider → Drop (${deliveryStatus})` : 'Rider → Drop'}
          </span>
          <span className="font-extrabold text-orange-600 tabular-nums">
            {metrics.partnerToCustomerKm != null
              ? formatDistanceKm(metrics.partnerToCustomerKm)
              : '—'}
          </span>
        </div>
      </div>

      {/* Interactive Leaflet Tracking Map */}
      <div
        className={`relative z-0 isolate w-full overflow-hidden rounded-2xl border border-stone-200 ${heightClass}`}
      >
        <MapContainer center={custLatLng} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
          <MapViewportController center={custLatLng} bounds={bounds} zoom={13} fitKey={fitKey} />

          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#0891b2', weight: 3.5, dashArray: '8 6', opacity: 0.85 }}
          />

          <Marker position={restLatLng} icon={createRestaurantPinIcon(false)}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-emerald-700">Pickup Restaurant</p>
                <p className="font-semibold text-slate-900">{restaurantName}</p>
              </div>
            </Popup>
          </Marker>

          {partnerLatLng && (
            <Marker position={partnerLatLng} icon={riderPinIcon}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-cyan-700">Delivery Partner (Live Pin)</p>
                  <p className="font-semibold text-slate-900">{partnerName}</p>
                  <p className="font-mono text-[11px] text-slate-500">
                    [{partnerCoords[0].toFixed(4)}, {partnerCoords[1].toFixed(4)}]
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          <Marker position={custLatLng} icon={customerPinIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-orange-600">Customer Drop</p>
                <p className="font-semibold text-slate-900">{customerLabel}</p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-extrabold text-white">
            R
          </span>
          Restaurant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[9px] font-extrabold text-white">
            D
          </span>
          Delivery Partner
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[9px] font-extrabold text-white">
            C
          </span>
          Customer
        </span>
      </div>
    </div>
  );
}
