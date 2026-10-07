import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
// UI-only refresh: no background service, notification or online-agent claim.
export function useForegroundRefresh(reload: () => Promise<void>, enabled: boolean, intervalMs = 7000) {
 useFocusEffect(useCallback(() => {
  if (!enabled) return;
  let running = false, stopped = false;
  const refresh = async () => { if (stopped || running || AppState.currentState !== 'active') return; running = true; try { await reload(); } finally { running = false; } };
  const timer = setInterval(() => { void refresh(); }, intervalMs);
  const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
  return () => { stopped = true; clearInterval(timer); subscription.remove(); };
 }, [enabled, reload, intervalMs]));
}
