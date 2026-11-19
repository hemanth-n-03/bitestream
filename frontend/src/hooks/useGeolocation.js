import { useCallback, useState } from 'react';

const GEOLOCATION_ERROR_MESSAGES = {
  1: 'Location permission was denied. Enable browser location access or pick a pin on the map.',
  2: 'Location signal is currently unavailable. Please select a Mysuru area manually.',
  3: 'Location request timed out. Try again or click directly on the map.',
};

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [accuracyMeters, setAccuracyMeters] = useState(null);

  const requestLocation = useCallback((onSuccess) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      const msg = 'Geolocation is not supported in this browser environment.';
      setError(msg);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = Number(pos.coords.longitude.toFixed(6));
        const lat = Number(pos.coords.latitude.toFixed(6));
        const geoCoords = [lng, lat];
        setCoordinates(geoCoords);
        setAccuracyMeters(Math.round(pos.coords.accuracy || 0));
        setLoading(false);
        if (onSuccess) onSuccess(geoCoords, pos.coords);
      },
      (err) => {
        const msg =
          GEOLOCATION_ERROR_MESSAGES[err.code] || 'Unable to retrieve your current location.';
        setError(msg);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 15000,
      }
    );
  }, []);

  return {
    loading,
    error,
    coordinates,
    accuracyMeters,
    requestLocation,
    clearError: () => setError(null),
  };
}
