import * as Location from 'expo-location';
import {Platform} from 'react-native';
import { capacityLocation, type ApproximateFix } from './privacy';
import {authorizedForegroundCapture} from './foreground-permission';
export async function captureCapacityLocation(radius: number, requestPermission = true, ready?:()=>void): Promise<ApproximateFix> {
  return authorizedForegroundCapture({read:()=>Location.getForegroundPermissionsAsync(),request:()=>Location.requestForegroundPermissionsAsync(),capture:async()=>{
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // SDK 57's web adapter spreads navigator options but defaults maximumAge to
    // Infinity. A manual refresh must not silently return an earlier device fix.
    const options:Location.LocationOptions&{maximumAge?:number}={accuracy:Location.Accuracy.High,...(Platform.OS==='web'?{maximumAge:0}:{})};
    const result = await Promise.race([
      Location.getCurrentPositionAsync(options),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Your phone could not find a location. Please try again.')), 20000); }),
    ]);
    // Exact coordinates exist only inside this callback; API/drafts receive the obscured fix.
    return capacityLocation(result.coords.latitude, result.coords.longitude, result.coords.accuracy, radius);
  } finally { if (timer) clearTimeout(timer); }
  }},requestPermission,ready);
}
