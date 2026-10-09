const listeners=new Set<()=>void>();
export function nativePushRefresh(){for(const listener of listeners)listener();}
export function watchNativePushRefresh(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
