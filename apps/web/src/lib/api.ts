import { AkoClient } from '@ako/sdk';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080/api/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const apiClient = new AkoClient({
  baseUrl: API_BASE,
  getToken: () => accessToken,
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      accessToken = null;
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
  },
});
