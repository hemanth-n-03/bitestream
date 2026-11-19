import apiClient from './client';
import { normalizeFoodItem } from './restaurantApi';

export async function fetchOwnerMenuApi(restaurantId) {
  const { data } = await apiClient.get('/food/my-menu', { params: { restaurantId } });
  return (data.data?.items || []).map(normalizeFoodItem);
}

export async function createFoodItemApi(payload) {
  const { data } = await apiClient.post('/food', payload);
  return normalizeFoodItem(data.data.item);
}

export async function updateFoodItemApi(foodId, payload) {
  const { data } = await apiClient.patch(`/food/${foodId}`, payload);
  return normalizeFoodItem(data.data.item);
}

export async function toggleFoodAvailabilityApi(foodId, availability) {
  const { data } = await apiClient.patch(`/food/${foodId}/availability`, { availability });
  return normalizeFoodItem(data.data.item);
}

export async function deleteFoodItemApi(foodId) {
  const { data } = await apiClient.delete(`/food/${foodId}`);
  return data.data;
}
