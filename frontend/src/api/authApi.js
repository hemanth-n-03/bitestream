import apiClient from './client';

export async function loginApi({ email, password }) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data.data;
}

export async function registerApi(payload) {
  const { data } = await apiClient.post('/auth/register', payload);
  return data.data;
}

export async function getMeApi() {
  const { data } = await apiClient.get('/auth/me');
  return data.data.user;
}

export async function updateUserProfileApi(payload) {
  const { data } = await apiClient.patch('/users/profile', payload);
  return data.data.user;
}
