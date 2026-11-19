import apiClient from './client';

export async function fetchNotificationsApi(params = {}) {
  const { data } = await apiClient.get('/notifications', { params });
  return data.data;
}

export async function markNotificationReadApi(notificationId) {
  const { data } = await apiClient.patch(`/notifications/${notificationId}/read`);
  return data.data;
}

export async function markAllNotificationsReadApi() {
  const { data } = await apiClient.patch('/notifications/read-all');
  return data.data;
}
