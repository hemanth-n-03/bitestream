import apiClient from './client';

export async function createOrderApi(payload, idempotencyKey) {
  const { data } = await apiClient.post('/orders', payload, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  return data.data;
}

export async function fetchMyOrdersApi(params = {}) {
  const { data } = await apiClient.get('/orders/my', { params });
  return data.data;
}

export async function fetchRestaurantOrdersApi(params = {}) {
  const { data } = await apiClient.get('/orders/restaurant', { params });
  return data.data;
}

export async function fetchOrderDetailsApi(orderId) {
  const { data } = await apiClient.get(`/orders/${orderId}`);
  return data.data;
}

export async function updateOrderStatusApi(orderId, { status, note }) {
  const { data } = await apiClient.patch(`/orders/${orderId}/status`, { status, note });
  return data.data.order;
}

export async function cancelOrderApi(orderId, reason) {
  const { data } = await apiClient.post(`/orders/${orderId}/cancel`, { reason });
  return data.data.order;
}

export async function reassignOrderDeliveryApi(orderId, payload = {}) {
  const { data } = await apiClient.post(`/orders/${orderId}/reassign`, payload);
  return data.data;
}
