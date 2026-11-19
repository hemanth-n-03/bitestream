// GeoJSON [longitude, latitude] coordinate & Leaflet distance helpers.
// Server-side discovery & dispatch use MongoDB 2dsphere indexes ($geoNear, $near, $geoWithin).

const EARTH_RADIUS_KM = 6371;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Validates GeoJSON [longitude, latitude] coordinate array.
 */
export function isValidGeoCoords(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    !Number.isNaN(lng) &&
    !Number.isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Converts MongoDB GeoJSON [longitude, latitude] to Leaflet [latitude, longitude].
 */
export function toLatLng(geoJsonCoords) {
  if (!isValidGeoCoords(geoJsonCoords)) return [12.3052, 76.6552];
  return [geoJsonCoords[1], geoJsonCoords[0]];
}

/**
 * Converts Leaflet (lat, lng) into MongoDB GeoJSON Point object [lng, lat].
 */
export function toGeoJsonPoint(lat, lng) {
  return {
    type: 'Point',
    coordinates: [Number(Number(lng).toFixed(6)), Number(Number(lat).toFixed(6))],
  };
}

/**
 * Computes great-circle distance in km between two GeoJSON [lng, lat] pairs.
 */
export function calculateDistanceKm(coordsA, coordsB) {
  if (!isValidGeoCoords(coordsA) || !isValidGeoCoords(coordsB)) return null;
  const [lng1, lat1] = coordsA;
  const [lng2, lat2] = coordsB;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function estimateDeliveryMinutes(distanceKm, prepMins = 18) {
  const travelMins = Math.max(6, Math.round((distanceKm || 2) * 4.5));
  const min = prepMins + travelMins;
  return `${min}-${min + 7} min`;
}

/**
 * Moves a GeoJSON [lng, lat] coordinate smoothly toward targetCoords by factor t (0..1).
 */
export function interpolateCoords(fromCoords, toCoords, t = 0.25) {
  if (!isValidGeoCoords(fromCoords) || !isValidGeoCoords(toCoords)) return fromCoords;
  const nextLng = fromCoords[0] + (toCoords[0] - fromCoords[0]) * t;
  const nextLat = fromCoords[1] + (toCoords[1] - fromCoords[1]) * t;
  return [Number(nextLng.toFixed(6)), Number(nextLat.toFixed(6))];
}

/**
 * Computes full trip distances between customer, restaurant, and delivery partner.
 */
export function calculateRouteMetrics({ restaurantCoords, customerCoords, partnerCoords }) {
  const restaurantToCustomerKm = calculateDistanceKm(restaurantCoords, customerCoords);
  const partnerToRestaurantKm = partnerCoords
    ? calculateDistanceKm(partnerCoords, restaurantCoords)
    : null;
  const partnerToCustomerKm = partnerCoords
    ? calculateDistanceKm(partnerCoords, customerCoords)
    : null;

  return {
    restaurantToCustomerKm,
    partnerToRestaurantKm,
    partnerToCustomerKm,
  };
}

// Preset Mysuru zones using strict GeoJSON [longitude, latitude] order
export const MYSURU_ZONES = [
  {
    id: 'gokulam',
    label: 'Gokulam 3rd Stage',
    address: 'Temple Road, Gokulam, Mysuru 570002',
    coordinates: [76.6258, 12.3282],
  },
  {
    id: 'vvmohalla',
    label: 'VV Mohalla',
    address: 'Kalidasa Road, VV Mohalla, Mysuru 570002',
    coordinates: [76.6299, 12.3198],
  },
  {
    id: 'saraswathipuram',
    label: 'Saraswathipuram',
    address: '1st Main Road, Saraswathipuram, Mysuru 570009',
    coordinates: [76.6311, 12.2994],
  },
  {
    id: 'palace',
    label: 'Mysuru Palace / City Centre',
    address: 'Sayyaji Rao Road, Agrahara, Mysuru 570001',
    coordinates: [76.6552, 12.3052],
  },
  {
    id: 'kuvempunagar',
    label: 'Kuvempunagar',
    address: 'Udayaravi Road, Kuvempunagar, Mysuru 570023',
    coordinates: [76.6224, 12.2886],
  },
  {
    id: 'hebbal',
    label: 'Hebbal Industrial Area',
    address: 'Ring Road, Hebbal 2nd Stage, Mysuru 570016',
    coordinates: [76.6122, 12.3454],
  },
];
