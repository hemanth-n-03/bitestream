import apiClient from './client';

export async function fetchAdminOverviewApi() {
  const { data } = await apiClient.get('/admin/overview');
  return data.data;
}

export async function fetchAdminOrdersApi(params = {}) {
  const { data } = await apiClient.get('/admin/orders', { params });
  return data.data;
}

export async function fetchAdminRestaurantsApi() {
  const { data } = await apiClient.get('/admin/restaurants');
  return data.data.restaurants || [];
}

export async function toggleAdminRestaurantStatusApi(restaurantId, isActive) {
  const { data } = await apiClient.patch(`/admin/restaurants/${restaurantId}/status`, {
    isActive,
  });
  return data.data.restaurant;
}

export async function fetchAdminUsersApi() {
  const { data } = await apiClient.get('/admin/users');
  return data.data.users || [];
}

export async function toggleAdminUserStatusApi(userId, isActive) {
  const { data } = await apiClient.patch(`/admin/users/${userId}/status`, { isActive });
  return data.data.user;
}

export async function fetchAdminPartnersApi() {
  const { data } = await apiClient.get('/admin/partners');
  return data.data.partners || [];
}
