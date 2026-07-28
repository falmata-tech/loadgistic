"use client";

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
  return <button type="button" className={`button secondary icon-button-label ${compact?'small':''}`} style={{width:compact?undefined:'100%'}} onClick={logout} disabled={working}><LogOut aria-hidden="true"/>{working?'Logging out…':'Log out'}</button>;
}
