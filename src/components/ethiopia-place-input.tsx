"use client";

import React from 'react';
import {useTranslation} from './localization';
import {LoadingIndicator} from './loading-state';
import { MapPin } from 'lucide-react';

type PlaceResult={
  id:string;
  name:string;
  display_name:string;
  country_name:string;
  country_code:string;
  place_type:string;
  lat:number;
  lng:number;
};

type Props=React.InputHTMLAttributes<HTMLInputElement>&{
  id:string;
  placeRefName?:string;
  defaultPlaceRef?:string;
  onPlaceSelect?:(place:PlaceResult)=>void;
};

const placeCache=new Map<string,PlaceResult[]>();

function cachePlaces(query:string,results:PlaceResult[]){
  if(placeCache.size>=100)placeCache.delete(placeCache.keys().next().value as string);
  placeCache.set(query,results);
}

export function EthiopiaPlaceInput({id,onChange,onBlur,value,defaultValue,placeRefName,defaultPlaceRef='',onPlaceSelect,...props}:Props) {
  const {t}=useTranslation();
  const [text,setText]=React.useState(String(value ?? defaultValue ?? ''));
  const [results,setResults]=React.useState([] as PlaceResult[]);
  const [open,setOpen]=React.useState(false);
  const [loading,setLoading]=React.useState(false);
  const [dirty,setDirty]=React.useState(false);
  const [placeRef,setPlaceRef]=React.useState(defaultPlaceRef);

  React.useEffect(()=>{
    if(value!==undefined)setText(String(value));
  },[value]);

  React.useEffect(()=>{
    const query=text.trim();
    if(!dirty||query.length<2){setResults([]);setLoading(false);return;}
    const cacheKey=query.toLocaleLowerCase();
    const cached=placeCache.get(cacheKey);
    if(cached){setResults(cached);setOpen(true);setLoading(false);return;}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const response=await fetch(`/api/places?q=${encodeURIComponent(query)}`,{signal:controller.signal});
        const body=response.ok?await response.json():{results:[]};
        const nextResults=body.results||[];
        cachePlaces(cacheKey,nextResults);
        setResults(nextResults);
        setOpen(true);
      }catch(error){
        if((error as Error).name!=='AbortError')setResults([]);
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    },220);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[dirty,text]);

  function update(event:React.ChangeEvent<HTMLInputElement>){
    setText(event.target.value);
    setPlaceRef('');
    setDirty(true);
    setOpen(true);
    onChange?.(event);
  }

  function choose(place:PlaceResult){
    setText(place.display_name);
    setPlaceRef(place.id);
    setOpen(false);
    setDirty(false);
    setResults([]);
    onChange?.({target:{value:place.display_name}} as React.ChangeEvent<HTMLInputElement>);
    onPlaceSelect?.(place);
  }

  return <div className="place-combobox">
    {placeRefName?<input type="hidden" name={placeRefName} value={placeRef}/>:null}
    <input {...props} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined} id={id} value={text} onChange={update} onFocus={()=>setOpen(true)} onBlur={event=>{
      window.setTimeout(()=>setOpen(false),120);
      onBlur?.(event);
    }} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open&&Boolean(results.length)} aria-controls={`${id}-results`}/>
    {loading?<LoadingIndicator className="place-loading" label="Searching places"/>:null}
    {open&&results.length?<div className="place-results" id={`${id}-results`} role="listbox">
      {results.map((place:PlaceResult)=><button type="button" role="option" className="place-result" key={place.id} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(place)}>
        <MapPin aria-hidden="true"/><span><strong>{place.display_name}</strong><small>{place.place_type}</small></span>
      </button>)}
    </div>:null}
  </div>;
}
