'use client';

import Image from 'next/image';
import React from 'react';
import {
  TRACTOR_TRAILER_CONFIGURATIONS,VEHICLE_CONFIGURATIONS,vehicleConfigurationImage
} from '@/lib/vehicle-configurations';

const INTERCHANGEABLE_TRACTOR='INTERCHANGEABLE_TRACTOR';
const FIXED_CONFIGURATIONS=VEHICLE_CONFIGURATIONS.filter(configuration=>
  !configuration.name.startsWith('Tractor + ')
);

export function VehicleRegistrationFields(){
  const [vehicleKind,setVehicleKind]=React.useState('');
  const [attachedTrailer,setAttachedTrailer]=React.useState(TRACTOR_TRAILER_CONFIGURATIONS[0].name as string);
  const [compatibleTrailers,setCompatibleTrailers]=React.useState(
    TRACTOR_TRAILER_CONFIGURATIONS.map(configuration=>configuration.name) as string[]
  );
  const tractor=vehicleKind===INTERCHANGEABLE_TRACTOR;
  const preview=tractor?vehicleConfigurationImage(attachedTrailer):vehicleConfigurationImage(vehicleKind);
  return <>
    <div className="form-group full">
      <label htmlFor="vehicle-configuration">Vehicle configuration</label>
      <select id="vehicle-configuration" name="vehicleKind" required value={vehicleKind} onChange={event=>setVehicleKind(event.target.value)}>
        <option value="" disabled>Choose the vehicle body</option>
        {FIXED_CONFIGURATIONS.map(item=><option value={item.name} key={item.name}>{item.name}</option>)}
        <option value={INTERCHANGEABLE_TRACTOR}>Interchangeable tractor</option>
      </select>
      <small>Courier cars carry small shipments; passenger booking is not offered.</small>
    </div>
    {tractor?<fieldset className="trailer-configuration-fields full">
      <legend>Trailer setup</legend>
      <div className="form-group">
        <label htmlFor="attached-trailer-registration">Currently attached trailer</label>
        <select id="attached-trailer-registration" name="cargoConfiguration" value={attachedTrailer} onChange={event=>{const next=event.target.value;setAttachedTrailer(next);setCompatibleTrailers((current:string[])=>current.includes(next)?current:[...current,next]);}}>
          {TRACTOR_TRAILER_CONFIGURATIONS.map(item=><option key={item.name} value={item.name}>{item.name.replace('Tractor + ','')}</option>)}
        </select>
        <small>This is the only trailer configuration shown on capacity pages.</small>
      </div>
      <div className="form-group">
        <span className="field-label">Compatible trailers</span>
        <div className="trailer-compatible-options">{TRACTOR_TRAILER_CONFIGURATIONS.map(item=><label key={item.name}><input type="checkbox" name="supportedTrailerConfigurations" value={item.name} checked={compatibleTrailers.includes(item.name)} onChange={event=>{if(item.name===attachedTrailer&&!event.target.checked)return;setCompatibleTrailers((current:string[])=>event.target.checked?[...new Set([...current,item.name])]:current.filter((value:string)=>value!==item.name));}}/><span>{item.name.replace('Tractor + ','')}</span></label>)}</div>
      </div>
    </fieldset>:<input type="hidden" name="cargoConfiguration" value={vehicleKind}/>}
    {vehicleKind?<div className="vehicle-configuration-preview full"><Image src={preview} alt={tractor?attachedTrailer:vehicleKind} width={240} height={180}/><span><strong>{tractor?'Current public configuration':vehicleKind}</strong><small>{tractor?attachedTrailer.replace('Tractor + ',''):'The selected vehicle artwork is used on capacity maps.'}</small></span></div>:null}
  </>;
}
