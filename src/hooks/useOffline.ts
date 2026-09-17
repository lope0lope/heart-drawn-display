import { useEffect, useMemo, useState } from 'react';
import { useConditionCodes, type ConditionCodeRecord } from '@/hooks/useCrocs';

const CODES_KEY = 'croctrack.condition-codes.cache.v1';

function isAllowedCaptureCondition(condition: ConditionCodeRecord): boolean {
  const code = condition.code.trim().toLowerCase();
  const name = condition.name.trim().toLowerCase();
  return code !== 'kk' && !name.startsWith('malnourish');
}

/** Live online/offline status of the device. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Condition codes that keep working with no connection: the last successful
 * fetch is mirrored to localStorage and used as the offline source of truth.
 */
export function useOfflineConditionCodes(): ConditionCodeRecord[] {
  const { data } = useConditionCodes();

  const [cached, setCached] = useState<ConditionCodeRecord[]>(() => {
    try {
      const raw = localStorage.getItem(CODES_KEY);
      return raw ? (JSON.parse(raw) as ConditionCodeRecord[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (data && data.length) {
      const allowed = data.filter(isAllowedCaptureCondition);
      try { localStorage.setItem(CODES_KEY, JSON.stringify(allowed)); } catch { /* ignore */ }
      setCached(allowed);
    }
  }, [data]);

  return useMemo(
    () => (data && data.length ? data : cached).filter(isAllowedCaptureCondition),
    [data, cached],
  );
}
