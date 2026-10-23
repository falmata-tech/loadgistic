"use client";


import {Text} from '@/components/localization';
import React from 'react';
import { LogOut } from 'lucide-react';

export function LogoutButton({compact=false}:{compact?:boolean}){
  const [working,setWorking]=React.useState(false);
  return <form action="/api/auth/logout" method="post" onSubmit={event=>{if(working)event.preventDefault();else setWorking(true);}}>
    <button type="submit" className={`button secondary icon-button-label ${compact?'small':''}`} style={{width:compact?undefined:'100%'}} disabled={working}><LogOut aria-hidden="true"/>{working?<Text message="Logging out…"/>:<Text message="Log out"/>}</button>
  </form>;
}
