import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function buildPinIcon({ bg, border = '#ffffff', glyph, size = 34, pulse = false }) {
  const pulseClass = pulse ? 'rider-marker-pulse' : '';
  return L.divIcon({
    className: 'bitestream-div-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div class="${pulseClass}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:2.5px solid ${border};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${Math.round(
      size * 0.42
    )}px;box-shadow:0 4px 12px rgba(15,23,42,0.35);">${glyph}</div>`,
  });
}

export const customerPinIcon = buildPinIcon({
  bg: '#ea580c',
  glyph: 'C',
  size: 34,
});

export function createRestaurantPinIcon(isSelected = false) {
  return buildPinIcon({
    bg: isSelected ? '#0f172a' : '#16a34a',
    border: isSelected ? '#fb923c' : '#ffffff',
    glyph: 'R',
    size: isSelected ? 38 : 32,
  });
}

export const riderPinIcon = buildPinIcon({
  bg: '#0891b2',
  glyph: 'D',
  size: 36,
  pulse: true,
});

/**
 * Ensures Leaflet recalculates layout when tabs/modals resize and fits bounds smoothly.
 * When fitKey is provided, fitBounds only triggers on fitKey changes so live GPS updates
 * do not snap the user's pan/zoom repeatedly.
 */
export function MapViewportController({ center, bounds, zoom = 14, fitKey }) {
  const map = useMap();
  const prevFitKeyRef = useRef(null);

  useEffect(() => {
    const container = map.getContainer();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    let observer;
    if (typeof ResizeObserver !== 'undefined' && container) {
      observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(container);
    }

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (Array.isArray(bounds) && bounds.length >= 2) {
      if (fitKey !== undefined && prevFitKeyRef.current === fitKey) {
        return;
      }
      prevFitKeyRef.current = fitKey;
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 15, animate: true });
      return;
    }
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center, bounds, zoom, fitKey]);

  return null;
}
