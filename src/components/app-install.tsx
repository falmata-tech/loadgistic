'use client';

import React from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {Download} from 'lucide-react';
import {Text} from './localization';

type InstallPrompt=Event&{prompt:()=>Promise<{outcome:'accepted'|'dismissed'}>};
type InstallWindow=Window&{loadgisticInstallPrompt?:InstallPrompt};

function takeAppInstallPrompt(){
 const source=window as InstallWindow;
 const prompt=source.loadgisticInstallPrompt;
 delete source.loadgisticInstallPrompt;
 return prompt;
}

export function AppInstallLink({className,onOpen}:{className?:string;onOpen?:()=>void}){
 const router=useRouter();
 const pathname=usePathname();
 return <Link href="/install" className={className} data-pwa-install-link="" aria-current={pathname==='/install'?'page':undefined} onClick={(event:React.MouseEvent<HTMLAnchorElement>)=>{
  onOpen?.();
  if(event.defaultPrevented||event.button!==0||event.altKey||event.metaKey||event.ctrlKey||event.shiftKey)return;
  const prompt=takeAppInstallPrompt();
  if(!prompt)return;
  event.preventDefault();
  void prompt.prompt().catch(()=>router.push('/install'));
 }}><Download aria-hidden="true"/><span><Text message="Install app"/></span></Link>;
}

export function AppInstall(){
 const [prompt,setPrompt]=React.useState(null as InstallPrompt|null);
 const [installed,setInstalled]=React.useState(false);
 const [apple,setApple]=React.useState(false);
 const [busy,setBusy]=React.useState(false);

 React.useEffect(()=>{
  const sync=()=>{
   setPrompt((window as InstallWindow).loadgisticInstallPrompt??null);
   setInstalled(document.documentElement.dataset.pwaInstalled==='true');
  };
  setApple(/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.platform)&&navigator.maxTouchPoints>1));
  sync();
  window.addEventListener('loadgistic-install-ready',sync);
  return ()=>window.removeEventListener('loadgistic-install-ready',sync);
 },[]);

 async function install(){
  if(!prompt||busy)return;
  setBusy(true);
  setPrompt(null);
  try{await takeAppInstallPrompt()?.prompt();}catch{/* The browser-menu instructions remain available. */}
  finally{setBusy(false);}
 }

 return <section className="public-information-heading container stack app-install-page" aria-busy={busy}>
  <h1><Text message="Install Loadgistic"/></h1>
  {installed?<p role="status"><Text message="Loadgistic is installed."/></p>:<>
   {prompt?<><p><Text message="Add Loadgistic to your device for quick access."/></p>
    <button type="button" className="button" onClick={()=>void install()}><Download aria-hidden="true"/><Text message="Install app"/></button></>:null}
   {!prompt&&!busy?<p><Text message={apple
    ?'In Safari, tap Share, then Add to Home Screen.'
    :'Open your browser menu and choose Install app or Add to Home screen.'}/></p>:null}
   {busy?<p role="status"><Text message="Waiting for your browser…"/></p>:null}
  </>}
 </section>;
}
