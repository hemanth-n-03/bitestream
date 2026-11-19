import apiClient from './client';

export async function fetchPartnerMeApi() {
  const { data } = await apiClient.get('/delivery/partner/me');
  return data.data.partner;
}

export async function togglePartnerAvailabilityApi(availability) {
  const { data } = await apiClient.patch('/delivery/partner/availability', { availability });
  return data.data.partner;
}

export async function updatePartnerLocationApi(coordinates) {
  const { data } = await apiClient.patch('/delivery/partner/location', { coordinates });
  return data.data.partner;
}

export async function fetchAvailableTasksApi() {
  const { data } = await apiClient.get('/delivery/tasks/available');
  return data.data.tasks || [];
}

export async function acceptDeliveryTaskApi(orderId) {
  const { data } = await apiClient.post(`/delivery/tasks/${orderId}/accept`);
  return data.data.order;
}

export async function confirmDeliveryTaskApi(orderId) {
  const { data } = await apiClient.post(`/delivery/tasks/${orderId}/confirm`);
  return data.data.order;
}

export async function rejectDeliveryTaskApi(orderId, reason) {
  const { data } = await apiClient.post(`/delivery/tasks/${orderId}/reject`, { reason });
  return data.data;
}

export async function fetchDeliveryHistoryApi(params = {}) {
  const { data } = await apiClient.get('/delivery/orders/history', { params });
  return data.data;
}
