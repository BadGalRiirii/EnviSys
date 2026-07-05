/**
 * Axios client with JWT auth.
 * - Attaches the access token to every request.
 * - Transparently refreshes an expired access token once, then retries.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const client = axios.create({ baseURL: API_URL });

export const tokenStore = {
  get access() {
    return localStorage.getItem("envisys_access");
  },
  get refresh() {
    return localStorage.getItem("envisys_refresh");
  },
  set(access: string, refresh?: string) {
    localStorage.setItem("envisys_access", access);
    if (refresh) localStorage.setItem("envisys_refresh", refresh);
  },
  clear() {
    localStorage.removeItem("envisys_access");
    localStorage.removeItem("envisys_refresh");
  },
};

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && !original._retried && tokenStore.refresh) {
      original._retried = true;
      try {
        refreshing ??= axios
          .post(`${API_URL}/auth/refresh/`, { refresh: tokenStore.refresh })
          .then((r) => {
            tokenStore.set(r.data.access, r.data.refresh);
            return r.data.access as string;
          })
          .finally(() => {
            refreshing = null;
          });
        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return client(original);
      } catch {
        tokenStore.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a readable message from a DRF error response. */
export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (typeof data?.detail === "string") return data.detail;
    if (data && typeof data === "object") {
      const first = Object.values(data)[0];
      if (Array.isArray(first)) return String(first[0]);
      if (typeof first === "string") return first;
    }
  }
  return "Something went wrong. Please try again.";
}
