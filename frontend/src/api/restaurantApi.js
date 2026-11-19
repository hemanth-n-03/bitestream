import apiClient from './client';

export function normalizeRestaurant(doc) {
  if (!doc) return null;
  const addrObj = typeof doc.address === 'object' && doc.address !== null ? doc.address : null;
  const fullAddress = addrObj
    ? [addrObj.street, addrObj.area, addrObj.city, addrObj.pincode].filter(Boolean).join(', ')
    : doc.address || '';

  return {
    ...doc,
    id: doc._id || doc.id,
    cuisines: doc.cuisineTypes || doc.cuisines || [],
    area: addrObj?.area || doc.area || 'Mysuru',
    fullAddress,
    distanceKm: doc.distanceKm ?? null,
  };
}

export function normalizeFoodItem(doc) {
  if (!doc) return null;
  const populatedRest =
    doc.restaurantId && typeof doc.restaurantId === 'object'
      ? normalizeRestaurant(doc.restaurantId)
      : null;

  return {
    ...doc,
    id: doc._id || doc.id,
    restaurantId: populatedRest ? populatedRest.id : doc.restaurantId,
    restaurant: populatedRest,
  };
}

export async function fetchNearbyRestaurants({
  latitude,
  longitude,
  radius = 15,
  category,
  search,
  sort = 'distance',
  vegOnly = false,
  openOnly = false,
  mode = 'geoNear',
  page = 1,
  limit = 20,
}) {
  const params = { latitude, longitude, radius, sort, mode, page, limit };
  if (category && category !== 'All') params.category = category;
  if (search && search.trim()) params.search = search.trim();
  if (vegOnly) params.vegOnly = true;
  if (openOnly) params.openOnly = true;

  const { data } = await apiClient.get('/restaurants/nearby', { params });
  return {
    restaurants: (data.data?.restaurants || []).map(normalizeRestaurant),
    pagination: data.data?.pagination,
    queryInfo: data.data?.queryInfo,
  };
}

export async function fetchRestaurantDetails(id, { latitude, longitude } = {}) {
  const params = {};
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get(`/restaurants/nearby/${id}`, { params });
  return {
    restaurant: normalizeRestaurant(data.data?.restaurant),
    menuCategories: data.data?.menuCategories || [],
  };
}

export async function fetchRestaurantMenu(id, { category, search, vegOnly, availableOnly } = {}) {
  const params = {};
  if (category && category !== 'All') params.category = category;
  if (search && search.trim()) params.search = search.trim();
  if (vegOnly) params.vegOnly = true;
  if (availableOnly) params.availableOnly = true;

  const { data } = await apiClient.get(`/restaurants/${id}/menu`, { params });
  return {
    restaurant: normalizeRestaurant(data.data?.restaurant),
    items: (data.data?.items || []).map(normalizeFoodItem),
    categories: data.data?.categories || [],
    pagination: data.data?.pagination,
  };
}

export async function fetchCategories() {
  const { data } = await apiClient.get('/restaurants/categories');
  return data.data?.categories || [];
}

export async function searchRestaurantsAndDishes({
  q,
  category,
  vegOnly,
  latitude,
  longitude,
  limit = 20,
}) {
  const params = { limit };
  if (q && q.trim()) params.q = q.trim();
  if (category && category !== 'All') params.category = category;
  if (vegOnly) params.vegOnly = true;
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get('/restaurants/search', { params });
  return {
    restaurants: (data.data?.restaurants || []).map(normalizeRestaurant),
    dishes: (data.data?.dishes || []).map(normalizeFoodItem),
    pagination: data.data?.pagination,
  };
}

export async function fetchOwnerRestaurantsApi() {
  const { data } = await apiClient.get('/restaurants/owner/dashboard');
  return (data.data?.restaurants || []).map(normalizeRestaurant);
}

export async function updateRestaurantLocationApi(restaurantId, { coordinates, address }) {
  const { data } = await apiClient.patch(`/restaurants/${restaurantId}/location`, {
    coordinates,
    address,
  });
  return normalizeRestaurant(data.data.restaurant);
}

export async function toggleRestaurantOpenApi(restaurantId, isOpen) {
  const { data } = await apiClient.patch(`/restaurants/${restaurantId}/status`, { isOpen });
  return normalizeRestaurant(data.data.restaurant);
}
