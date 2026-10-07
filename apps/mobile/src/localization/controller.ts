export const languages = [
  {code:'en',name:'English'}, {code:'am',name:'አማርኛ'},
  {code:'om',name:'Afaan Oromo'}, {code:'so',name:'Soomaali'}, {code:'ti',name:'ትግርኛ'},
] as const;
export type Locale = typeof languages[number]['code'];
export type Messages = Record<string,string>;
type Port = {read:()=>Promise<string|null>;write:(locale:Locale)=>Promise<void>;load:(locale:Locale)=>Promise<Messages>;changed:()=>void};
export function localeCode(value:unknown):Locale { return languages.some(item=>item.code===value)?value as Locale:'en'; }
export function createLanguageController(port:Port) {
  let locale:Locale='en',messages:Messages={},error='',busy=false,epoch=0;
  const select=async(value:Locale)=>{
    if(busy)return;
    ++epoch;busy=true;error='';port.changed();
    try { const next=await port.load(value);await port.write(value);locale=value;messages=next; }
    catch { error='Could not save your language. Please try again.'; }
    finally {busy=false;port.changed();}
  };
  return {snapshot:()=>({locale,messages,error,busy}),select,async restore(){
    const generation=epoch;
    try {const saved=localeCode(await port.read());const next=await port.load(saved);if(generation===epoch){locale=saved;messages=next;port.changed();}}
    catch {if(generation===epoch){error='Could not restore your language. Choose it again.';port.changed();}}
  }};
}
