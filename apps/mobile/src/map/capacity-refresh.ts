import {reconcileCapacityMapWindow} from '../../../../src/lib/capacity-map-loading.js';

export type CapacityRefreshResult<T>={key:string;items:T[];loading:boolean;error:string};
export type CapacityRefreshUpdate<T>={phase:'page'|'complete';items:T[]}|{phase:'failed'|'denied';error:string};

/** Result updates are bound to one actor/audience/filter permission scope. */
export function capacityRefreshResult<T extends {id:string}>(previous:CapacityRefreshResult<T>|null,key:string,update:CapacityRefreshUpdate<T>):CapacityRefreshResult<T>{
 if('items' in update)return {key,items:reconcileCapacityMapWindow(previous?.key===key?previous.items:[],update.items,null,update.phase==='complete'),loading:update.phase==='page',error:''};
 return {key,items:update.phase==='denied'?[]:previous?.key===key?previous.items:[],loading:false,error:update.error};
}
