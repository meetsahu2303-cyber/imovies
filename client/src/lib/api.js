import axios from 'axios';
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 20000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});
let refreshPromise;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url.startsWith('/auth/')
    ) {
      original._retry = true;
      try {
        refreshPromise ||= api.post('/auth/refresh').finally(() => {
          refreshPromise = undefined;
        });
        await refreshPromise;
        return api(original);
      } catch {
        window.dispatchEvent(new Event('imovies:session-expired'));
      }
    }
    return Promise.reject(error);
  },
);
export const errorMessage = (error) =>
  error.response?.data?.error?.details?.map((d) => d.message).join(' ') ||
  error.response?.data?.error?.message ||
  (error.code === 'ECONNABORTED'
    ? 'The request timed out. Please try again.'
    : 'Unable to connect. Please check your connection and try again.');
export const money = (paise) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format((paise || 0) / 100);
export const dateLabel = (value, options = {}) =>
  new Date(value).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    ...options,
  });
export const timeLabel = (value) =>
  new Date(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
export const runtime = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
export const todayIST = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const upcomingDates = () =>
  Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 86400000));
