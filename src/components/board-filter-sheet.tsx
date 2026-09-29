"use client";


import {Localized,Text} from '@/components/localization';
import React from 'react';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';

type ActiveFilter={
  label:string;
  href?:string;
};

type BoardFilterSheetProps={
  title:string;
  description?:string;
  applyLabel:string;
  clearHref:string;
  resultLabel:string;
  activeFilters?:ActiveFilter[];
  search?:{
    id:string;
    value:string;
    placeholder:string;
    hiddenFields?:Record<string,string>;
  };
  children:React.ReactNode;
};

export function BoardFilterSheet({
  title,
  description,
  applyLabel,
  clearHref,
  resultLabel,
  activeFilters=[],
  search,
  children
}:BoardFilterSheetProps){
  const dialogRef=React.useRef(null) as {current:HTMLDialogElement|null};
  const dialogId=React.useId();
  const open=()=>dialogRef.current?.showModal();
  const close=()=>dialogRef.current?.close();

  return <Localized as="section" copy={["aria-label"]} className="board-filter-shell" aria-label="Board search and filters">
    <div className="board-filter-toolbar">
      {search?<form className="board-quick-search" method="get" role="search">
        {Object.entries(search.hiddenFields||{}).filter(([,value])=>Boolean(value)).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
        <label className="sr-only" htmlFor={search.id}><Text message="Search"/></label>
        <Search aria-hidden="true"/>
        <input id={search.id} name="q" type="search" defaultValue={search.value} placeholder={search.placeholder}/>
        <Localized as="button" copy={["aria-label","title"]} className="button icon-only" aria-label="Search" title="Search"><Search aria-hidden="true"/></Localized>
      </form>:null}
      <button className="button secondary icon-button-label" type="button" onClick={open} {...{command:'show-modal',commandfor:dialogId}}>
        <SlidersHorizontal aria-hidden="true"/><Text message="Filters"/>{activeFilters.length?<span className="filter-count" aria-label={`${activeFilters.length} active filters`}>{activeFilters.length}</span>:null}
      </button>
      <strong className="board-result-count">{resultLabel}</strong>
    </div>
    {activeFilters.length?<Localized as="div" copy={["aria-label"]} className="applied-filter-row" aria-label="Active filters">
      {activeFilters.map((filter,index)=>filter.href
        ?<a className="applied-filter" href={filter.href} key={`${filter.label}-${index}`} aria-label={`Remove ${filter.label}`} title={`Remove ${filter.label}`}>
          <span>{filter.label}</span><X aria-hidden="true"/>
        </a>
        :<span className="applied-filter" key={`${filter.label}-${index}`}>{filter.label}</span>)}
      <a className="clear-filter-link" href={clearHref}><X aria-hidden="true"/><Text message="Clear all"/></a>
    </Localized>:null}
    <dialog className="board-filter-dialog" id={dialogId} ref={dialogRef} onClick={event=>{
      if(event.target===dialogRef.current) close();
    }}>
      <form className="board-filter-form" method="get">
        <header className="board-filter-dialog-header">
          <div className="task-heading">
            <span className="task-heading-icon"><SlidersHorizontal aria-hidden="true"/></span>
            <div><h2><Text message={title}/></h2>{description?<p><Text message={description}/></p>:null}</div>
          </div>
          <Localized as="button" copy={["aria-label","title"]} className="button secondary icon-only" type="button" onClick={close} aria-label="Close filters" title="Close filters" {...{command:'close',commandfor:dialogId}}>
            <X aria-hidden="true"/>
          </Localized>
        </header>
        <div className="board-filter-dialog-body">{children}</div>
        <footer className="board-filter-dialog-actions">
          <a className="button secondary icon-button-label" href={clearHref}><X aria-hidden="true"/><Text message="Clear"/></a>
          <button className="button icon-button-label"><Check aria-hidden="true"/><Text message={applyLabel}/></button>
        </footer>
      </form>
    </dialog>
  </Localized>;
}
