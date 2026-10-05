"use client";


import {Text} from '@/components/localization';
import React from 'react';
import { LogOut } from 'lucide-react';

export function LogoutButton({compact=false}:{compact?:boolean}){
  const [working,setWorking]=React.useState(false);
  async function logout(){
    if(working)return;
    setWorking(true);
    try{
      await fetch('/api/auth/logout',{method:'POST',cache:'no-store',credentials:'same-origin'});
    }finally{
      window.location.replace('/login?success=You+have+been+logged+out');
    }
  }
  return <button type="button" className={`button secondary icon-button-label ${compact?'small':''}`} style={{width:compact?undefined:'100%'}} onClick={logout} disabled={working}><LogOut aria-hidden="true"/>{working?<Text message="Logging out…"/>:<Text message="Log out"/>}</button>;
}
