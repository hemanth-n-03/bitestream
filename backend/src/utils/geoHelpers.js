const EARTH_RADIUS_KM = 6378.1;

export function kmToMeters(km) {
  return Math.round(Number(km) * 1000);
}

export function kmToRadians(km) {
  return Number(km) / EARTH_RADIUS_KM;
}

export function escapeRegex(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function calculateSphericalKm(coordsA, coordsB) {
  if (!Array.isArray(coordsA) || !Array.isArray(coordsB)) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const [lng1, lat1] = coordsA;
  const [lng2, lat2] = coordsB;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((6371 * c).toFixed(2));
}
