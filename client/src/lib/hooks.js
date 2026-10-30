import { useState, useEffect, useCallback, useRef } from 'react';
import { api, errorMessage } from './api';
export function useApi(url, skip = false) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (skip || !url) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .get(url, { signal: controller.signal })
      .then((r) => setData(r.data))
      .catch((e) => {
        if (e.code !== 'ERR_CANCELED') setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, skip, version]);
  return { data, loading, error, reload, setData };
}
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
export function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)),
  );
  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return {
    remaining,
    label: `${Math.floor(remaining / 60)
      .toString()
      .padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`,
    expired: remaining === 0,
  };
}
