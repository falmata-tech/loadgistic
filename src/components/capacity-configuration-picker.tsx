'use client';
import React from 'react';
import Image from 'next/image';
import {Check,ChevronDown,Truck} from 'lucide-react';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';
import {Text} from './localization';

export function CapacityConfigurationPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const disclosure=React.useRef(null as HTMLDetailsElement|null);
 const selected=VEHICLE_CONFIGURATIONS.find(item=>item.name===value);
 function finishSelection(event:React.MouseEvent<HTMLInputElement>){if(event.detail===0)return;requestAnimationFrame(()=>{if(disclosure.current){disclosure.current.open=false;disclosure.current.querySelector('summary')?.focus();}});}
 return <fieldset className="capacity-configuration-picker">
  <legend><Text message="Truck configuration"/></legend>
  <details ref={disclosure}>
   <summary>{selected?<Image src={selected.image} alt="" width={76} height={52}/>:<Truck aria-hidden="true"/>}<span>{selected?selected.name:<Text message="Any configuration"/>}</span><ChevronDown className="configuration-chevron" aria-hidden="true"/></summary>
   <div className="capacity-configuration-options">
    <label className="capacity-configuration-option any-configuration"><Truck aria-hidden="true"/><span><Text message="Any configuration"/></span><input type="radio" name="vehicleCategory" value="" checked={!value} onChange={()=>onChange('')} onClick={finishSelection}/><Check className="configuration-check" aria-hidden="true"/></label>
    {VEHICLE_CONFIGURATIONS.map(item=><label className="capacity-configuration-option" key={item.name}>
     <Image src={item.image} alt="" width={180} height={112} sizes="(max-width: 600px) 42vw, 195px"/>
     <span>{item.name}</span><input type="radio" name="vehicleCategory" value={item.name} checked={value===item.name} onChange={()=>onChange(item.name)} onClick={finishSelection}/><Check className="configuration-check" aria-hidden="true"/>
    </label>)}
   </div>
  </details>
 </fieldset>;
}
