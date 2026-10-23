// Presentation only; the server always validates explicit acknowledgements.
const visible=new Map<string,number>();
const blockers=new Set<object>(),listeners=new Set<()=>void>();
export function blockChatReading(source:object,blocked:boolean){if(blocked)blockers.add(source);else blockers.delete(source);for(const listener of listeners)listener();}
export function chatReadingBlocked(){return blockers.size>0;}
export function watchChatReading(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function setVisibleChat(key:string,sequence:number|null){if(sequence===null)visible.delete(key);else visible.set(key,sequence);}
export function isChatMessageVisible(key:string,sequence:number){return !chatReadingBlocked()&&(visible.get(key)??-1)>=sequence;}
