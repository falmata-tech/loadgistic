"use client";

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { CircleDotDashed, LocateFixed, ShieldCheck } from 'lucide-react';
import { BUSINESS_SEARCH_PRIVACY_KM, obscureCoordinate } from '@/lib/location-privacy.js';

type Point={lat:number;lng:number};
type TruckArea={id:string;label:string;lat:number;lng:number;radiusKm:number};

const NearbyMap=dynamic(()=>import('./nearby-truck-map-leaflet').then(module=>module.NearbyTruckMapLeaflet),{
  ssr:false,
  loading:()=> <div className="nearby-truck-map loading-map">Loading privacy-area map...</div>
});

export function NearbyTruckSearch({active,radiusKm,trucks}:{active:boolean;radiusKm:number;trucks:TruckArea[]}) {
  const router=useRouter();
  const searchParams=useSearchParams();
  const [exactPoint,setExactPoint]=React.useState(null as Point|null);
  const [status,setStatus]=React.useState('idle' as 'idle'|'locating'|'ready'|'denied'|'error');

  function useMyLocation(){
    if(!navigator.geolocation){setStatus('error');return;}
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(position=>{
      const exact={lat:position.coords.latitude,lng:position.coords.longitude};
      if(exact.lat<3||exact.lat>15||exact.lng<32||exact.lng>49){setStatus('error');return;}
      const shared=obscureCoordinate(exact.lat,exact.lng,BUSINESS_SEARCH_PRIVACY_KM);
      setExactPoint(exact);
      setStatus('ready');
      const params=new URLSearchParams(searchParams.toString());
      params.set('nearLat',String(shared.lat));
      params.set('nearLng',String(shared.lng));
      params.set('nearRadiusKm',String(radiusKm));
      params.set('movementScope','LOCAL');
      params.delete('page');
      router.replace(`/app/capacity?${params.toString()}`);
    },error=>setStatus(error.code===error.PERMISSION_DENIED?'denied':'error'),{
      enableHighAccuracy:true,timeout:12000,maximumAge:60000
    });
  }

  function changeRadius(event:React.ChangeEvent<HTMLSelectElement>){
    const params=new URLSearchParams(searchParams.toString());
    params.set('nearRadiusKm',event.target.value);
    params.delete('page');
    router.replace(`/app/capacity?${params.toString()}`);
  }

  return <section className="nearby-truck-search" aria-labelledby="nearby-trucks-title">
    <div className="nearby-truck-search-copy"><ShieldCheck aria-hidden="true"/><div><h2 id="nearby-trucks-title">Find Local trucks near me</h2><p>Your exact position stays in this page. Loadgistic receives a point displaced by {BUSINESS_SEARCH_PRIVACY_KM} km and compares it with each Driver&apos;s chosen privacy area.</p></div></div>
    <div className="nearby-truck-actions">
      <button type="button" className="button icon-button-label" onClick={useMyLocation} disabled={status==='locating'}><LocateFixed aria-hidden="true"/>{status==='locating'?'Finding your area...':active?'Update my location':'Use my location'}</button>
      <label htmlFor="nearby-truck-radius"><CircleDotDashed aria-hidden="true"/>Within <select id="nearby-truck-radius" value={radiusKm} onChange={changeRadius} disabled={!active}>{[3,5,10,20,50].map(radius=><option value={radius} key={radius}>{radius} km</option>)}</select></label>
    </div>
    {status==='denied'?<p className="alert warning">Location permission is off. Enable it for this site, then try again.</p>:null}
    {status==='error'?<p className="alert warning">A usable location in Ethiopia was not available. You can still search by city below.</p>:null}
    {active?<p className="nearby-distance-note">Results are possible matches because both sides use privacy areas. Confirm the actual location and fit directly.</p>:null}
    {active&&exactPoint?<NearbyMap viewer={exactPoint} trucks={trucks}/>:null}
    {active&&!exactPoint?<p className="meta">Use your location again to place your private “You” point on the map. Truck results below remain privacy-area matches.</p>:null}
  </section>;
}
