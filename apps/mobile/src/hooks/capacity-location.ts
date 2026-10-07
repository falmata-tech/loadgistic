import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import type {CapacityTruck, CapacityWorkspace} from '../api/capacity';
import {captureCapacityLocation} from '../location/capture';
import {foregroundCapacityDue, refreshForegroundCapacity} from '../location/foreground-capacity';
import {useAccount} from '../session/provider';

export function useCapacityLocation(truck: CapacityTruck, editing: boolean, refresh: () => Promise<void>) {
  const account = useAccount(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const focused = useRef(false), generation = useRef(0), lock = useRef(false), lastAttempt = useRef(0);
  const current = useRef({truck, editing, request: account.request, refresh});
  useEffect(() => { current.current = {truck, editing, request: account.request, refresh}; }, [truck, editing, account.request, refresh]);
  // Changing identity/assignment/duty or opening an editor invalidates pending GPS.
  useEffect(() => { generation.current++; }, [account.session?.user.id, truck.id, truck.canLocate, truck.current?.status, truck.location?.radius, editing]);
  const tick = useCallback(async () => {
    const latest = current.current;
    if (!focused.current || AppState.currentState !== 'active' || latest.editing || lock.current || !foregroundCapacityDue(latest.truck, lastAttempt.current)) return;
    const version = generation.current, attemptedAt = Date.now();
    const active = () => focused.current && AppState.currentState === 'active' && !current.current.editing && generation.current === version;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await refreshForegroundCapacity({vehicleId: latest.truck.id, lastAttempt: lastAttempt.current, active,
        read: () => latest.request('/api/mobile/capacity') as Promise<CapacityWorkspace>,
        capture: radius => captureCapacityLocation(radius, false),
        save: body => latest.request('/api/mobile/capacity', body)});
      if (result !== 'paused') lastAttempt.current = attemptedAt;
      if (active()) await latest.refresh();
    } catch (error) {
      lastAttempt.current = attemptedAt;
      if (active()) setError(error instanceof Error ? error.message : 'Could not save truck location. Please try again.');
    } finally { lock.current = false; setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true; void tick();
    const interval = setInterval(() => { void tick(); }, 60000);
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') generation.current++;
      else void tick();
    });
    return () => { focused.current = false; generation.current++; clearInterval(interval); listener.remove(); };
  }, [tick]));
  // Data normally arrives after the focus effect; do not wait a minute to start.
  useEffect(() => { void tick(); }, [tick, truck.id, truck.current?.status, truck.canLocate, editing]);
  const shareLocation = async () => {
    if (lock.current || !focused.current || current.current.editing || AppState.currentState !== 'active') return;
    const latest=current.current; let version=generation.current;
    const active=()=>focused.current && AppState.currentState==='active' && !current.current.editing && generation.current===version;
    lock.current=true; setBusy(true); setError('');
    try {
      const workspace=await latest.request('/api/mobile/capacity') as CapacityWorkspace;
      const assigned=workspace.vehicles.find(item=>item.id===latest.truck.id);
      if (!assigned?.canLocate) throw new Error('This truck is no longer available in your workspace.');
      if (!active()) return;
      const captured=await captureCapacityLocation(assigned.location?.radius||20,true,()=>{
        if (!focused.current || current.current.editing || AppState.currentState!=='active') throw new Error('Location sharing paused. Return to this screen and try again.');
        version=generation.current;
      });
      if (!active()) return;
      await latest.request('/api/mobile/capacity',{action:'LOCATION',vehicleId:assigned.id,...captured});
      lastAttempt.current=Date.now();
      if (active()) await latest.refresh();
    } catch (error) {
      if (active()) setError(error instanceof Error?error.message:'Could not save truck location. Please try again.');
    } finally { lock.current=false; setBusy(false); }
  };
  return {busy, error, shareLocation};
}
