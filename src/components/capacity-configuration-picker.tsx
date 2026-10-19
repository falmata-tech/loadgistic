'use client';
import React from 'react';
import Image from 'next/image';
import {Check,ChevronDown,Truck} from 'lucide-react';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';
import {capacityFilterValues,capacityFilterValue} from '@/lib/capacity-filter-values.js';
import {Text,useTranslation} from './localization';

export function CapacityConfigurationPicker({value,onChange,multiple=false}:{value:string;onChange:(value:string)=>void;multiple?:boolean}){
  const {t}=useTranslation();
 const [expanded,setExpanded]=React.useState(false);
 const disclosure=React.useRef(null as HTMLDetailsElement|null);
 const selected=VEHICLE_CONFIGURATIONS.find(item=>item.name===value);
 let selections:string[]=[];if(multiple)try{selections=capacityFilterValues('vehicleCategory',value);}catch{/* Preserve malformed input for backend denial until it is edited. */}
 const preview=multiple?VEHICLE_CONFIGURATIONS.find(item=>item.name===selections[0]):selected;
 function finishSelection(event:React.MouseEvent<HTMLInputElement>){if(event.detail===0)return;requestAnimationFrame(()=>{if(disclosure.current){disclosure.current.open=false;disclosure.current.querySelector('summary')?.focus();}});}
 return <fieldset className={`capacity-configuration-picker${multiple?' is-multiple':''}`} data-filter-group="vehicleCategory">
  <legend><Text message="Vehicle type"/></legend>
  {multiple?<input type="hidden" name="vehicleCategory" value={value}/>:null}
  <details ref={disclosure} onToggle={event=>setExpanded(event.currentTarget.open)}>
   <summary>{preview?<Image src={preview.image} alt="" width={76} height={52}/>:<Truck aria-hidden="true"/>}<span>{multiple&&selections.length>1?<><Text message="{count} configurations selected" values={{count:selections.length}}/><small>{selections.map(name=>t(name)).join(' · ')}</small></>:preview?t(preview.name):<Text message="Any configuration"/>}</span><ChevronDown className="configuration-chevron" aria-hidden="true"/></summary>
   <div className="capacity-configuration-options">
    {multiple?<button type="button" className="capacity-configuration-option any-configuration" data-clear-options aria-pressed={selections.length===0} onClick={()=>onChange('')}><Truck aria-hidden="true"/><span><Text message="Any configuration"/></span></button>:<label className="capacity-configuration-option any-configuration"><Truck aria-hidden="true"/><span><Text message="Any configuration"/></span><input type="radio" name="vehicleCategory" value="" checked={!value} onChange={()=>onChange('')} onClick={finishSelection}/><Check className="configuration-check" aria-hidden="true"/></label>}
    {VEHICLE_CONFIGURATIONS.map(item=><label className="capacity-configuration-option" key={item.name}>
     <Image src={item.image} alt="" width={180} height={112} sizes="(max-width: 600px) 42vw, 195px" loading={expanded?'eager':'lazy'} unoptimized/>
     <span><Text message={item.name}/></span>{multiple?<input type="checkbox" value={item.name} checked={selections.includes(item.name)} onChange={event=>onChange(capacityFilterValue('vehicleCategory',event.target.checked?[...selections,item.name]:selections.filter(name=>name!==item.name)))}/>:<input type="radio" name="vehicleCategory" value={item.name} checked={value===item.name} onChange={()=>onChange(item.name)} onClick={finishSelection}/>}<Check className="configuration-check" aria-hidden="true"/>
    </label>)}
   </div>
  </details>
 </fieldset>;
}
