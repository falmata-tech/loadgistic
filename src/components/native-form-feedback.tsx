'use client';

import React from 'react';
import {usePathname} from 'next/navigation';

// Native POSTs do not use React's server-action form status. Keep their actual
// submitter name/value intact; disabled controls would drop commands from POST.
export function NativeFormFeedback(){
  const pathname=usePathname();
  const [message,setMessage]=React.useState('');
  React.useEffect(()=>{
    const clear=()=>{
      document.querySelectorAll('[data-native-submitting]').forEach(form=>{form.removeAttribute('data-native-submitting');form.removeAttribute('aria-busy');});
      document.querySelectorAll('[data-pending-submit]').forEach(button=>{button.removeAttribute('data-pending-submit');button.removeAttribute('aria-disabled');});
      setMessage('');
    };
    clear();
    const submit=(event:SubmitEvent)=>{
      const form=event.target;
      if(!(form instanceof HTMLFormElement)||form.method.toLowerCase()!=='post'||form.target==='_blank')return;
      if(form.hasAttribute('data-native-submitting')){event.preventDefault();return;}
      queueMicrotask(()=>{
        // Fetch-driven forms own their own loading and error state.
        if(event.defaultPrevented)return;
        form.setAttribute('data-native-submitting','');form.setAttribute('aria-busy','true');
        event.submitter?.setAttribute('data-pending-submit','');event.submitter?.setAttribute('aria-disabled','true');
        setMessage('Submitting…');
      });
    };
    document.addEventListener('submit',submit);
    window.addEventListener('pageshow',clear);
    return()=>{document.removeEventListener('submit',submit);window.removeEventListener('pageshow',clear);clear();};
  },[pathname]);
  return <span className="sr-only" role="status" aria-live="polite">{message}</span>;
}
