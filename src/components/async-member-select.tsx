"use client";

import React from 'react';
import { Building2, Heart, LoaderCircle, Search, Truck } from 'lucide-react';

type Member={
  id:string;
  ref_kind:'org'|'profile';
  name:string;
  type:string;
  city?:string;
  is_favorite?:boolean;
};

export function AsyncMemberSelect({
  id,
  name,
  kind,
  label,
  placeholder,
  initialRef='',
  initialLabel='',
  required=false
}:{
  id:string;
  name:string;
  kind:'BUSINESS'|'TRANSPORT';
  label:string;
  placeholder:string;
  initialRef?:string;
  initialLabel?:string;
  required?:boolean;
}){
  const [query,setQuery]=React.useState(initialLabel);
  const [selected,setSelected]=React.useState(initialRef);
  const [results,setResults]=React.useState([] as Member[]);
  const [loading,setLoading]=React.useState(false);
  const [open,setOpen]=React.useState(false);

  React.useEffect(()=>{
    const value=query.trim();
    if(value.length<2||selected){setResults([]);return;}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const response=await fetch(`/api/directory/search?kind=${kind}&q=${encodeURIComponent(value)}`,{signal:controller.signal});
        const body=response.ok?await response.json():{results:[]};
        setResults(body.results||[]);
        setOpen(true);
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    },220);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[kind,query,selected]);

  function clearSelection(value:string){
    setQuery(value);
    setSelected('');
    setOpen(true);
  }

  return <div className="form-group member-search-field">
    <label htmlFor={id}>{kind==='BUSINESS'?<Building2 aria-hidden="true"/>:<Truck aria-hidden="true"/>}{label}</label>
    <input type="hidden" name={name} value={selected} required={required}/>
    <div className="member-search-input">
      <Search aria-hidden="true"/>
      <input id={id} value={query} onChange={event=>clearSelection(event.target.value)} onFocus={()=>setOpen(true)} autoComplete="off" placeholder={placeholder} aria-expanded={open&&Boolean(results.length)} role="combobox"/>
      {loading?<LoaderCircle className="member-search-loading" aria-label="Searching members"/>:null}
    </div>
    {!selected&&query.length<2?<small>Type at least 2 characters.</small>:null}
    {open&&results.length?<div className="member-search-results" role="listbox">{results.map((member:Member)=><button type="button" role="option" key={`${member.ref_kind}:${member.id}`} onClick={()=>{
      setSelected(`${member.ref_kind}:${member.id}`);
      setQuery(member.name);
      setOpen(false);
    }}>
      {kind==='BUSINESS'?<Building2 aria-hidden="true"/>:<Truck aria-hidden="true"/>}
      <span><strong>{member.name}</strong><small>{member.city||member.type}</small></span>
      {member.is_favorite?<Heart aria-label="Favorite"/>:null}
    </button>)}</div>:null}
  </div>;
}
