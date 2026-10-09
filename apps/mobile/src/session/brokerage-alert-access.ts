export const brokerageStorageKey='loadgistic.brokerage.v1';
const listeners=new Set<()=>void>();
export function brokerageAccessChanged(){for(const listener of listeners)listener();}
export function watchBrokerageAccess(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
