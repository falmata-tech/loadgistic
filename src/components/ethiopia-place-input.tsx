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

export function EthiopiaPlaceInput({id,onChange,onBlur,onKeyDown,value,defaultValue,placeRefName,defaultPlaceRef='',onPlaceSelect,...props}:Props) {
  const {t}=useTranslation();
  const [text,setText]=React.useState(String(value ?? defaultValue ?? ''));
  const [results,setResults]=React.useState([] as PlaceResult[]);
  const [open,setOpen]=React.useState(false);
  const [loading,setLoading]=React.useState(false);
  const [dirty,setDirty]=React.useState(false);
  const [placeRef,setPlaceRef]=React.useState(defaultPlaceRef);
  const [activeIndex,setActiveIndex]=React.useState(-1);
  const optionRefs=React.useRef([] as Array<HTMLButtonElement|null>);

  React.useEffect(()=>{
    if(value!==undefined)setText(String(value));
  },[value]);

  React.useEffect(()=>{
    const query=text.trim();
    if(!dirty||query.length<2){setResults([]);setLoading(false);return;}
    const cacheKey=query.toLocaleLowerCase();
    const cached=placeCache.get(cacheKey);
    if(cached){setResults(cached);setLoading(false);return;}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const response=await fetch(`/api/places?q=${encodeURIComponent(query)}`,{signal:controller.signal});
        const body=response.ok?await response.json():{results:[]};
        if(controller.signal.aborted)return;
        const nextResults=body.results||[];
        cachePlaces(cacheKey,nextResults);
        setResults(nextResults);
      }catch(error){
        if((error as Error).name!=='AbortError')setResults([]);
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    },220);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[dirty,text]);

  React.useEffect(()=>{
    if(open&&activeIndex>=0)optionRefs.current[activeIndex]?.scrollIntoView({block:'nearest'});
  },[open,activeIndex]);

  function update(event:React.ChangeEvent<HTMLInputElement>){
    setText(event.target.value);
    setPlaceRef('');
    setResults([]);
    setActiveIndex(-1);
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
    setActiveIndex(-1);
    onChange?.({target:{value:place.display_name}} as React.ChangeEvent<HTMLInputElement>);
    onPlaceSelect?.(place);
  }

  function keyDown(event:React.KeyboardEvent<HTMLInputElement>){
    onKeyDown?.(event);
    if(event.defaultPrevented||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&results.length){
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index:number)=>event.key==='ArrowDown'
        ?!open||index<0||index>=results.length-1?0:index+1
        :!open||index<=0?results.length-1:index-1);
    }else if(event.key==='Enter'&&open&&results.length){
      event.preventDefault();
      choose(results[activeIndex]||results[0]);
    }else if(event.key==='Escape'&&open&&(results.length>0||loading)){
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return <div className="place-combobox" onBlur={event=>{
    if(!event.currentTarget.contains(event.relatedTarget as Node|null)){
      setOpen(false);
      setActiveIndex(-1);
    }
  }}>
    {placeRefName?<input type="hidden" name={placeRefName} value={placeRef}/>:null}
    <input {...props} placeholder={props.placeholder?t(props.placeholder):undefined} aria-label={props['aria-label']?t(props['aria-label']):undefined} id={id} value={text} onChange={update} onKeyDown={keyDown} onFocus={()=>setOpen(true)} onBlur={onBlur} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open&&Boolean(results.length)} aria-controls={`${id}-results`} aria-activedescendant={open&&activeIndex>=0&&results[activeIndex]?`${id}-option-${activeIndex}`:undefined}/>
    {loading?<LoadingIndicator className="place-loading" label="Searching places"/>:null}
    {open&&results.length?<div className="place-results" id={`${id}-results`} role="listbox">
      {results.map((place:PlaceResult,index:number)=><button type="button" role="option" id={`${id}-option-${index}`} aria-selected={index===activeIndex} tabIndex={-1} ref={node=>{optionRefs.current[index]=node;}} className="place-result" key={place.id} onPointerDown={event=>event.preventDefault()} onClick={()=>choose(place)}>
        <MapPin aria-hidden="true"/><span><strong>{place.display_name}</strong><small>{place.place_type}</small></span>
      </button>)}
    </div>:null}
  </div>;
}
