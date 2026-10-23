export type CapacityFilterKey='vehicleCategory'|'status'|'loadType'|'stopOption'|'freshness'|'locationSource';
export type CapacityFilterGroups=Record<CapacityFilterKey,string>;
export const CAPACITY_FILTER_CHOICES:Readonly<Record<CapacityFilterKey,readonly string[]>>;
export function capacityFilterValues(key:CapacityFilterKey,value:unknown):string[];
export function capacityFilterValue(key:CapacityFilterKey,values:unknown):string;
export function parseCapacityFilterValues(value:unknown,key:CapacityFilterKey):string|null;
export function canonicalCapacityFilters(filters?:Partial<Record<CapacityFilterKey,unknown>>):CapacityFilterGroups;
export function capacityFilterParams(params:URLSearchParams):CapacityFilterGroups;
export function capacityFilterRecord(record:Record<string,unknown>):CapacityFilterGroups;
