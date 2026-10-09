'use client';
import React from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {calendarDates,calendarDay,calendarPeriod,dateAllowed,dateOnly,shiftCalendar,todayDate,type CalendarView} from '@/lib/date-calendar';
import {useTranslation} from './localization';

type Props={id?:string;name:string;defaultValue?:string;value?:string;onChange?:(value:string)=>void;min?:string;max?:string;required?:boolean;disabled?:boolean;label?:string};
export function DatePicker({id,name,defaultValue='',value,onChange,min='',max='',required=false,disabled=false,label='Choose date'}:Props){
 const {locale,t}=useTranslation(),autoId=React.useId(),inputId=id||autoId;
 const [saved,setSaved]=React.useState(defaultValue),[anchor,setAnchor]=React.useState(defaultValue||min||'2000-01-03'),[view,setView]=React.useState('week' as CalendarView);
 const selected=value??saved,dialog=React.useRef(null as HTMLDialogElement|null),button=React.useRef(null as HTMLButtonElement|null),input=React.useRef(null as HTMLInputElement|null);
 React.useEffect(()=>{if(input.current)input.current.setCustomValidity(required&&!dateOnly(selected)?t('Choose a date.'):selected&&!dateAllowed(selected,min,max)?t('Choose an allowed date.'):'');},[required,selected,min,max,t]);
 function close(){dialog.current?.close();button.current?.focus();}
 function choose(day:string){if(!dateAllowed(day,min,max))return;setSaved(day);onChange?.(day);close();}
 function open(){setAnchor(dateOnly(selected)?selected:min&&min>todayDate()?min:todayDate());setView('week');dialog.current?.showModal();}
 return <div className="date-picker">
  <input ref={input} className="date-picker-validation" tabIndex={-1} aria-hidden="true" name={name} value={selected} required={required} disabled={disabled} onChange={()=>{}} onInvalid={event=>{event.preventDefault();open();}}/>
  <button id={inputId} ref={button} type="button" className="date-picker-trigger" onClick={open} disabled={disabled} aria-haspopup="dialog"><CalendarDays aria-hidden="true"/>{dateOnly(selected)?calendarDay(selected,locale).label:t(label)}</button>
  <dialog ref={dialog} className="date-picker-dialog" aria-label={t(label)} onClose={()=>button.current?.focus()} onClick={event=>{if(event.target===dialog.current)close();}}>
   <div className="date-picker-header"><strong>{t(label)}</strong><button type="button" className="icon-button" aria-label={t('Close')} onClick={close}><X/></button></div>
   <div className="date-picker-views">{(['week','month'] as const).map(mode=><button key={mode} type="button" aria-pressed={view===mode} onClick={()=>setView(mode)}>{t(mode==='week'?'Week':'Month')}</button>)}</div>
   <div className="date-picker-period"><button type="button" aria-label={t(view==='week'?'Previous week':'Previous month')} onClick={()=>setAnchor(shiftCalendar(anchor,view,-1))}><ChevronLeft/></button><strong aria-live="polite">{calendarPeriod(anchor,view,locale)}</strong><button type="button" aria-label={t(view==='week'?'Next week':'Next month')} onClick={()=>setAnchor(shiftCalendar(anchor,view,1))}><ChevronRight/></button></div>
   <div className="date-picker-grid">{calendarDates(anchor,view).map(day=>{const info=calendarDay(day,locale);return <button key={day} type="button" disabled={!dateAllowed(day,min,max)} className={selected===day?'selected':''} aria-pressed={selected===day} aria-label={`${info.label}${info.ethiopian?`, ${t('Ethiopian calendar')}: ${info.ethiopian.label}`:''}`} onClick={()=>choose(day)}><small>{info.weekday}</small><strong>{info.day}</strong>{info.ethiopian&&<span>{info.ethiopian.day}</span>}</button>;})}</div>
   {calendarDay(anchor,locale).ethiopian&&<p className="date-picker-legend">{t('Gregorian date above · Ethiopian date below')}</p>}
   <div className="date-picker-footer"><button type="button" onClick={()=>setAnchor(todayDate())}>{t('Today')}</button>{!required&&<button type="button" onClick={()=>{setSaved('');onChange?.('');close();}}>{t('Clear date')}</button>}</div>
  </dialog>
 </div>;
}
