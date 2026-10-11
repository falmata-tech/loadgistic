'use client';
import {useRouter} from 'next/navigation';
import React from 'react';
import {Text} from './localization';

export function FeaturedRetry(){
 const router=useRouter(),[pending,startTransition]=React.useTransition();
 return <button className="button" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}><Text message="Refresh"/></button>;
}
