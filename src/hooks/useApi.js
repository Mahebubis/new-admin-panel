import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';

/**
 * Custom hook to fetch API data with automatic deduplication,
 * abort on unmount, and loading state management.
 * Prevents duplicate calls from React StrictMode double-mount.
 */
export function useApiGet(url, params = {}, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    // Abort previous request if still in flight
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params, signal: controller.signal });
      if (!controller.signal.aborted) {
        setData(res.data.success ? res.data.data : null);
        setLoading(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err);
        setLoading(false);
      }
    }
  }, [url, paramsKey]);

  useEffect(() => {
    fetchData();
    return () => { if (controllerRef.current) controllerRef.current.abort(); };
  }, [fetchData, ...deps]);

  return { data, loading, error, refetch: fetchData };
}
