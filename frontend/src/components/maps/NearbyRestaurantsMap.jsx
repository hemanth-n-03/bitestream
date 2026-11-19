import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Clock, MapPin, Star } from 'lucide-react';
import { estimateDeliveryMinutes, toLatLng } from '../../utils/geo';
import { formatDistanceKm } from '../../utils/formatters';
import {
  MapViewportController,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  createRestaurantPinIcon,
  customerPinIcon,
} from './MapPrimitives';

export default function NearbyRestaurantsMap({
  customerZone,
  restaurants,
  radiusKm = null,
  heightClass = 'h-[360px] sm:h-[440px]',
}) {
  const customerLatLng = useMemo(
    () => toLatLng(customerZone.coordinates),
    [customerZone.coordinates]
  );

  const bounds = useMemo(() => {
    const pts = [customerLatLng];
    restaurants.forEach((r) => {
      if (r.location?.coordinates) {
        pts.push(toLatLng(r.location.coordinates));
      }
    });
    return pts.length >= 2 ? pts : null;
  }, [customerLatLng, restaurants]);

  return (
    <div className="space-y-2">
      <div
        className={`relative z-0 isolate w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-xs ${heightClass}`}
      >
        <MapContainer center={customerLatLng} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
          <MapViewportController center={customerLatLng} bounds={bounds} zoom={13} />

          {radiusKm && (
            <Circle
              center={customerLatLng}
              radius={radiusKm * 1000}
              pathOptions={{
                color: '#ea580c',
                fillColor: '#fb923c',
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: '6 6',
              }}
            />
          )}

          {/* Customer Pin */}
          <Marker position={customerLatLng} icon={customerPinIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-orange-600">Delivery Destination</p>
                <p className="font-semibold text-slate-900">{customerZone.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{customerZone.address}</p>
              </div>
            </Popup>
          </Marker>

          {/* Restaurant Pins from MongoDB 2dsphere API */}
          {restaurants.map((rest) => {
            const restId = rest.id || rest._id;
            const cuisines = rest.cuisines || rest.cuisineTypes || [];
            const pos = toLatLng(rest.location.coordinates);
            return (
              <Marker key={restId} position={pos} icon={createRestaurantPinIcon(false)}>
                <Popup>
                  <div className="min-w-[190px] space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900">{rest.name}</p>
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {(rest.rating?.average ?? 4.5).toFixed(1)}
                        <Star className="h-2.5 w-2.5 fill-current" />
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{cuisines.join(' • ')}</p>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-600" />
                        {formatDistanceKm(rest.distanceKm)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-orange-500" />
                        {estimateDeliveryMinutes(rest.distanceKm, rest.prepTimeMins)}
                      </span>
                    </div>
                    <Link
                      to={`/restaurant/${restId}`}
                      className="mt-1 block rounded-lg bg-orange-600 py-1.5 text-center text-[11px] font-bold text-white hover:bg-orange-700"
                    >
                      Open Menu →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[9px] font-extrabold text-white">
              C
            </span>
            Your Location ({customerZone.label})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-extrabold text-white">
              R
            </span>
            Mysuru Partner Kitchens ({restaurants.length})
          </span>
        </div>
        <span>Leaflet + OpenStreetMap • MongoDB 2dsphere Live</span>
      </div>
    </div>
  );
}
