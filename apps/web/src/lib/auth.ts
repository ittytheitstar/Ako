import { apiClient, setAccessToken } from './api';

export async function login(username: string, password: string) {
  const { accessToken, refreshToken } = await apiClient.login(username, password);
  setAccessToken(accessToken);
  if (typeof window !== 'undefined') {
    localStorage.setItem('refreshToken', refreshToken);
  }
  return { accessToken, refreshToken };
}

export function logout() {
  setAccessToken(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
}

export async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const { accessToken, refreshToken: newRefresh } = await apiClient.refreshToken(refreshToken);
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', newRefresh);
    return true;
  } catch {
    return false;
  }
}
