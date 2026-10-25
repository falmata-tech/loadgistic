"use client";

import React from 'react';
import L from 'leaflet';
import {Polygon,Polyline,useMap,useMapEvents} from 'react-leaflet';
import {offsetSignalPath,signalLaneZoom,signalLaneLimit} from '@/lib/map-signal-offset';

export type SignalPath={positions:[number,number][];closed:boolean;offset:number};

export function OffsetSignalPolyline({positions,offset,closed=false,avoid,eventHandlers,pathOptions,children}:{positions:[number,number][];offset:number;closed?:boolean;avoid?:SignalPath;eventHandlers?:L.LeafletEventHandlerFnMap;pathOptions:L.PathOptions;children?:React.ReactNode}){
  const map=useMap();
  const [revision,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),resize:()=>setRevision((value:number)=>value+1)});
  React.useEffect(()=>{setRevision((value:number)=>value+1);},[map]);
  const shifted=React.useMemo(()=>{
    if(!offset||positions.length<2)return positions;
    const zoom=signalLaneZoom(map.getZoom(),256),limit=signalLaneLimit(zoom,256);
    const pixels=positions.map(position=>map.project(position,zoom));
    const loop=closed||(positions[0][0]===positions.at(-1)![0]&&positions[0][1]===positions.at(-1)![1]);
    const reference=avoid?offsetSignalPath(avoid.positions.map(position=>map.project(position,zoom)),avoid.offset,avoid.closed,[],limit):[];
    if(avoid?.closed&&reference.length)reference.push({...reference[0]});
    return offsetSignalPath(pixels,loop?Math.sign(offset)*12:offset,loop,reference.length?[reference]:[],limit).map(pixel=>{
      const latLng=map.unproject(L.point(pixel.x,pixel.y),zoom);
      return [latLng.lat,latLng.lng] as [number,number];
    });
  },[map,offset,positions,closed,avoid,revision]);
  if(closed)return <Polygon positions={shifted} eventHandlers={eventHandlers} pathOptions={pathOptions}>{children}</Polygon>;
  return <Polyline positions={shifted} eventHandlers={eventHandlers} pathOptions={pathOptions}>{children}</Polyline>;
}
