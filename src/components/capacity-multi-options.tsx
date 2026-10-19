'use client';
import React from 'react';
import {capacityFilterValues,capacityFilterValue,type CapacityFilterKey} from '@/lib/capacity-filter-values.js';
import {Text} from './localization';

export function CapacityMultiOptions({name,label,anyLabel,options,value,onChange,icon}:{name:CapacityFilterKey;label:string;anyLabel:string;options:readonly (readonly [string,string])[];value:string;onChange:(value:string)=>void;icon?:React.ReactNode}){
 const id=React.useId();
 let selected:string[]=[];try{selected=capacityFilterValues(name,value);}catch{/* Keep invalid input submitted until the visitor explicitly changes it. */}
 return <fieldset className="capacity-option-group" data-filter-group={name}>
  <legend>{icon}<Text message={label}/></legend>
  <input type="hidden" name={name} value={value}/>
  <button type="button" className="capacity-any-option" data-clear-options aria-pressed={selected.length===0} onClick={()=>onChange('')}><Text message={anyLabel}/></button>
  <div className="capacity-option-choices">{options.map(([option,title])=><label className="checkbox-label" htmlFor={`${id}-${option}`} key={option}>
   <input id={`${id}-${option}`} type="checkbox" value={option} checked={selected.includes(option)} onChange={event=>onChange(capacityFilterValue(name,event.target.checked?[...selected,option]:selected.filter(item=>item!==option)))}/><Text message={title}/>
  </label>)}</div>
 </fieldset>;
}
