export type MapPoint={key:string;coordinate:[number,number];cluster:number|null;count:number;itemId:string};
// Focus is synchronous: a late rendered-feature query must never restore other
// trucks or clusters over the selected truck. Closing reuses the loaded overview.
export function focusedMarkers(visible:MapPoint[],selectedId:string|undefined,coordinate:[number,number]|null):MapPoint[]{
 if(!selectedId)return visible;
 return coordinate?[{key:`truck:${selectedId}`,coordinate,cluster:null,count:1,itemId:selectedId}]:[];
}
