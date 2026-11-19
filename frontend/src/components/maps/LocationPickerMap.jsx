import { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { AlertCircle, Crosshair, Loader2, MapPin } from 'lucide-react';
import { MYSURU_ZONES, toLatLng } from '../../utils/geo';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  MapViewportController,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  createRestaurantPinIcon,
  customerPinIcon,
} from './MapPrimitives';

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      const lng = Number(e.latlng.lng.toFixed(6));
      const lat = Number(e.latlng.lat.toFixed(6));
      onPick([lng, lat]);
    },
  });
  return null;
}

export default function LocationPickerMap({
  coordinates,
  onChangeCoordinates,
  pinLabel = 'Selected Location',
  variant = 'customer',
  showPresets = true,
  heightClass = 'h-72 sm:h-80',
}) {
  const { loading, error, accuracyMeters, requestLocation, clearError } = useGeolocation();

  const centerLatLng = useMemo(() => toLatLng(coordinates), [coordinates]);
  const icon = useMemo(
    () => (variant === 'restaurant' ? createRestaurantPinIcon(true) : customerPinIcon),
    [variant]
  );

  const handleUseGps = () => {
    requestLocation((geoCoords) => {
      onChangeCoordinates(geoCoords, 'Browser GPS Pin');
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <MapPin className="h-4 w-4 text-orange-600" />
          <span>Click anywhere or drag pin • GeoJSON:</span>
          <code className="rounded bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 tabular-nums">
            [{coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}]
          </code>
        </div>

        <button
          type="button"
          onClick={handleUseGps}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" />
          )}
          {loading ? 'Detecting GPS...' : 'Use Current GPS'}
        </button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            {error}
          </span>
          <button
            type="button"
            onClick={clearError}
            className="font-bold text-rose-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {accuracyMeters != null && !error && (
        <p className="text-[11px] font-medium text-emerald-700">
          GPS lock acquired (±{accuracyMeters} m accuracy)
        </p>
      )}

      <div
        className={`relative z-0 isolate w-full overflow-hidden rounded-2xl border border-stone-200 ${heightClass}`}
      >
        <MapContainer
          center={centerLatLng}
          zoom={14}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
          <MapViewportController center={centerLatLng} zoom={14} />
          <MapClickHandler onPick={(coords) => onChangeCoordinates(coords, 'Custom Map Pin')} />
          <Marker
            position={centerLatLng}
            icon={icon}
            draggable
            eventHandlers={{
              dragend(e) {
                const { lat, lng } = e.target.getLatLng();
                onChangeCoordinates(
                  [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
                  'Dragged Map Pin'
                );
              },
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-slate-900">{pinLabel}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-600">
                  [{coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}]
                </p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Mysuru Presets:</span>
          {MYSURU_ZONES.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => onChangeCoordinates(zone.coordinates, zone.label, zone.address)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
            >
              {zone.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
