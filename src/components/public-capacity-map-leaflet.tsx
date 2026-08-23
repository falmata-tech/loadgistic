"use client";

import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';

type Point={lat:number;lng:number};
type PlacePoint={place_ref:string;label:string;lat:number;lng:number};
type Signal={id:string;provider_name:string;platform_number?:string;status:string;cargo_configuration?:string;availability_geometry?:string|null;current_signal_geometry_visible?:boolean;location_lat?:number;location_lng?:number;location_precision_km?:number;work_radius_km?:number;capacity_area_center_label?:string;capacity_area_center_lat?:number;capacity_area_center_lng?:number;capacity_area_boundary?:PlacePoint[];current_route_points?:PlacePoint[];recurring_corridors?:any[]};
type MapSignalInfo={id:string;accent:'location'|'empty'|'partial'|'regular';label:string;title:string;primary:string;detail:string};

function hasCoordinate(value:unknown){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
const EAST_AFRICA_MAP_BOUNDS=L.latLngBounds([-12.5,28],[18,52.5]);

function ResizeMap(){
  const map=useMap();
  React.useEffect(()=>{
    const host=map.getContainer().parentElement;
    if(!host||typeof ResizeObserver==='undefined')return;
    let frame=0;
    const resize=()=>{window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(()=>map.invalidateSize({animate:false,pan:false}));};
    const observer=new ResizeObserver(resize);
    observer.observe(host);
    resize();
    return()=>{observer.disconnect();window.cancelAnimationFrame(frame);};
  },[map]);
  return null;
}

function OffsetPolyline({positions,offset,eventHandlers,pathOptions}:{positions:[number,number][];offset:number;eventHandlers:any;pathOptions:any}){
  const map=useMap();
  const [revision,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),resize:()=>setRevision((value:number)=>value+1)});
  const shifted=React.useMemo(()=>{
    if(!offset||positions.length<2)return positions;
    const zoom=map.getZoom();
    const pixels=positions.map(position=>map.project(position,zoom));
    return pixels.map((pixel,index)=>{
      const before=pixels[Math.max(0,index-1)];
      const after=pixels[Math.min(pixels.length-1,index+1)];
      const dx=after.x-before.x,dy=after.y-before.y;
      const length=Math.hypot(dx,dy)||1;
      const shiftedPoint=L.point(pixel.x-(dy/length)*offset,pixel.y+(dx/length)*offset);
      const latLng=map.unproject(shiftedPoint,zoom);
      return [latLng.lat,latLng.lng] as [number,number];
    });
  },[map,offset,positions,revision]);
  return <Polyline positions={shifted} eventHandlers={eventHandlers} pathOptions={pathOptions}/>;
}

function Bounds({items,viewer,selectedId}:{items:Signal[];viewer:Point|null;selectedId:string|null}){
  const map=useMap();
  const fittedInitial=React.useRef(false);
  const fittedSelected=React.useRef('');
  const fittedViewer=React.useRef('');
  React.useEffect(()=>{
    if(!selectedId)fittedSelected.current='';
    const selected=items.find(item=>item.id===selectedId);
    if(selected&&fittedSelected.current!==selected.id){
      const selectedBounds=L.latLngBounds([]);
      if(hasCoordinate(selected.location_lat)&&hasCoordinate(selected.location_lng))selectedBounds.extend(L.latLng(Number(selected.location_lat),Number(selected.location_lng)).toBounds(Math.max(Number(selected.location_precision_km)||20,selected.availability_geometry==='RADIUS'?Number(selected.work_radius_km)||50:0)*2200));
      (selected.current_route_points||[]).forEach(point=>selectedBounds.extend([point.lat,point.lng]));
      (selected.capacity_area_boundary||[]).forEach(point=>selectedBounds.extend([point.lat,point.lng]));
      (selected.recurring_corridors||[]).forEach(signal=>{
        (signal.route_points||[]).forEach((point:PlacePoint)=>selectedBounds.extend([point.lat,point.lng]));
        (signal.area_boundary||[]).forEach((point:PlacePoint)=>selectedBounds.extend([point.lat,point.lng]));
        if(hasCoordinate(signal.area_center_lat)&&hasCoordinate(signal.area_center_lng))selectedBounds.extend([Number(signal.area_center_lat),Number(signal.area_center_lng)]);
      });
      if(viewer)selectedBounds.extend([viewer.lat,viewer.lng]);
      if(selectedBounds.isValid()){fittedSelected.current=selected.id;map.fitBounds(selectedBounds,{padding:[48,48],maxZoom:10,animate:false});return;}
    }
    const viewerKey=viewer?`${viewer.lat.toFixed(4)}:${viewer.lng.toFixed(4)}`:'';
    if(viewer&&fittedViewer.current!==viewerKey){fittedViewer.current=viewerKey;map.fitBounds(L.latLng(viewer.lat,viewer.lng).toBounds(100_000),{padding:[28,28],maxZoom:9,animate:false});return;}
    if(fittedInitial.current)return;
    const bounds=L.latLngBounds([]);
    for(const item of items){
      if(hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))bounds.extend([Number(item.location_lat),Number(item.location_lng)]);
      (item.current_route_points||[]).forEach(point=>bounds.extend([point.lat,point.lng]));
      (item.capacity_area_boundary||[]).forEach(point=>bounds.extend([point.lat,point.lng]));
      (item.recurring_corridors||[]).forEach(signal=>{
        (signal.route_points||[]).forEach((point:PlacePoint)=>bounds.extend([point.lat,point.lng]));
        (signal.area_boundary||[]).forEach((point:PlacePoint)=>bounds.extend([point.lat,point.lng]));
        if(hasCoordinate(signal.area_center_lat)&&hasCoordinate(signal.area_center_lng))bounds.extend([Number(signal.area_center_lat),Number(signal.area_center_lng)]);
      });
    }
    if(bounds.isValid()){
      fittedInitial.current=true;
      if(map.getSize().x<=620)map.setView([9.1,40.2],6,{animate:false});
      else map.fitBounds(bounds,{padding:[28,28],maxZoom:9,animate:false});
    }
  },[items,map,selectedId,viewer]);
  return null;
}

function truckMarker(item:Signal,selected=false,zoom=10){
  const partial=item.status==='PARTIAL';
  const statusClass=partial?'partial':'empty';
  const statusLabel=partial?'Partial':'Empty';
  const markerConfiguration=item.cargo_configuration==='Heavy Rigid Stake Body Truck + Trailer'?'Heavy Rigid Stake Body Truck':item.cargo_configuration;
  const image=vehicleConfigurationImage(markerConfiguration);
  const size:[number,number]=selected?[96,112]:zoom<=6?[56,66]:zoom<=8?[64,75]:[82,96];
  return L.divIcon({className:`capacity-truck-map-marker vehicle-image-marker ${statusClass}${selected?' selected':''}`,html:`<span class="vehicle-marker-image"><span class="vehicle-marker-content"><img src="${image}" alt=""/><strong>${statusLabel}</strong></span></span>`,iconSize:size,iconAnchor:[size[0]/2,size[1]]});
}

function routeMidpoint(points:PlacePoint[]):[number,number]|null{
  if(points.length<2)return null;
  const lengths=points.slice(1).map((point,index)=>L.latLng(points[index].lat,points[index].lng).distanceTo(L.latLng(point.lat,point.lng)));
  const total=lengths.reduce((sum,length)=>sum+length,0);
  if(!total)return [points[0].lat,points[0].lng];
  let remaining=total/2;
  for(let index=0;index<lengths.length;index+=1){
    if(remaining<=lengths[index]){const ratio=remaining/lengths[index];return [points[index].lat+(points[index+1].lat-points[index].lat)*ratio,points[index].lng+(points[index+1].lng-points[index].lng)*ratio];}
    remaining-=lengths[index];
  }
  return [points.at(-1)!.lat,points.at(-1)!.lng];
}

function regularServicePoint(item:Signal):[number,number]|null{
  const signal=(item.recurring_corridors||[])[0];
  if(!signal)return null;
  if(signal.geometry==='ROUTE')return routeMidpoint(signal.route_points||[]);
  if(hasCoordinate(signal.area_center_lat)&&hasCoordinate(signal.area_center_lng))return [Number(signal.area_center_lat),Number(signal.area_center_lng)];
  const boundary=signal.area_boundary||[];
  return boundary.length?[boundary.reduce((sum:number,point:PlacePoint)=>sum+point.lat,0)/boundary.length,boundary.reduce((sum:number,point:PlacePoint)=>sum+point.lng,0)/boundary.length]:null;
}

function markerPoint(item:Signal):[number,number]|null{
  if(item.current_signal_geometry_visible!==false&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))return [Number(item.location_lat),Number(item.location_lng)];
  if(item.current_signal_geometry_visible!==false&&item.availability_geometry==='ROUTE'&&(item.current_route_points||[]).length>=2)return routeMidpoint(item.current_route_points||[]);
  if(item.current_signal_geometry_visible===false)return regularServicePoint(item);
  return null;
}

function CapacityMarkers({items,selectedId,onSelect}:{items:Signal[];selectedId:string|null;onSelect:(id:string)=>void}){
  const map=useMap();
  const [,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),moveend:()=>setRevision((value:number)=>value+1)});
  const selected=items.find(item=>item.id===selectedId);
  if(selected){const point=markerPoint(selected);return point?<Marker position={point} icon={truckMarker(selected,true)} zIndexOffset={2000}/>:null;}
  const zoom=map.getZoom();
  type MarkerEntry={item:Signal;point:[number,number];pixel:L.Point;status:'EMPTY'|'PARTIAL'};
  type MarkerGroup={point:[number,number];items:Signal[];status:'EMPTY'|'PARTIAL';cellKey:string;part:number;partCount:number};
  const renderBounds=map.getBounds().pad(.35);
  const entries:MarkerEntry[]=items.flatMap(item=>{const point=markerPoint(item);return point&&renderBounds.contains(point)?[{item,point,pixel:map.project(point,zoom),status:item.status==='PARTIAL'?'PARTIAL':'EMPTY'}]:[];});
  const screenCellPx=zoom<=6?64:zoom<=8?58:zoom<=10?54:48;
  const buckets=new Map<string,MarkerEntry[]>();
  for(const entry of entries){
    const key=[entry.status,Math.floor(entry.pixel.x/screenCellPx),Math.floor(entry.pixel.y/screenCellPx)].join(':');
    const bucket=buckets.get(key);
    if(bucket)bucket.push(entry);else buckets.set(key,[entry]);
  }
  const groups:MarkerGroup[]=[];
  for(const [cellKey,bucket] of buckets){
    const partCount=Math.ceil(bucket.length/8);
    for(let part=0;part<partCount;part+=1){
      const members=bucket.slice(part*8,(part+1)*8);
      const averagePixel=members.reduce((sum,entry)=>sum.add(entry.pixel),L.point(0,0)).divideBy(members.length);
      const averagePoint=map.unproject(averagePixel,zoom);
      groups.push({point:[averagePoint.lat,averagePoint.lng],items:members.map(entry=>entry.item),status:members[0].status,cellKey,part,partCount});
    }
  }
  const minSpacing=zoom<=6?72:zoom<=8?82:100;
  const occupied=new Map<string,L.Point[]>();
  const cellFor=(pixel:L.Point)=>`${Math.floor(pixel.x/minSpacing)}:${Math.floor(pixel.y/minSpacing)}`;
  const isFree=(pixel:L.Point)=>{
    const cellX=Math.floor(pixel.x/minSpacing),cellY=Math.floor(pixel.y/minSpacing);
    for(let x=cellX-1;x<=cellX+1;x+=1)for(let y=cellY-1;y<=cellY+1;y+=1){
      for(const placed of occupied.get(`${x}:${y}`)||[])if(placed.distanceTo(pixel)<minSpacing)return false;
    }
    return true;
  };
  const reserve=(pixel:L.Point)=>{const key=cellFor(pixel);const cell=occupied.get(key);if(cell)cell.push(pixel);else occupied.set(key,[pixel]);};
  const candidateOffsets:[number,number][]=[[0,0]];
  const separationRings=Math.max(4,Math.ceil(Math.sqrt(groups.length))+2);
  for(let ring=1;ring<=separationRings;ring+=1){
    for(let x=-ring;x<=ring;x+=1){candidateOffsets.push([x,-ring],[x,ring]);}
    for(let y=-ring+1;y<ring;y+=1){candidateOffsets.push([-ring,y],[ring,y]);}
  }
  const displayedGroups=groups
    .sort((first,second)=>{
      const firstPoint=map.project(first.point,zoom),secondPoint=map.project(second.point,zoom);
      return firstPoint.y-secondPoint.y||firstPoint.x-secondPoint.x||first.status.localeCompare(second.status)||first.cellKey.localeCompare(second.cellKey)||first.part-second.part;
    })
    .map(group=>{
    const pixel=map.project(group.point,zoom);
    const partOffset=(group.part-(group.partCount-1)/2)*minSpacing;
    const singleMarkerHeight=zoom<=6?66:zoom<=8?75:96;
    const visibleCenterOffsetY=group.items.length===1?-singleMarkerHeight/2:0;
    const desired=L.point(pixel.x,pixel.y+partOffset+visibleCenterOffsetY);
    const chosen=candidateOffsets.map(([x,y])=>L.point(desired.x+x*minSpacing,desired.y+y*minSpacing)).find(isFree)!;
    reserve(chosen);
    const separated=map.unproject(L.point(chosen.x,chosen.y-visibleCenterOffsetY),zoom);
    return {group,point:[separated.lat,separated.lng] as [number,number]};
  });
  return <>{displayedGroups.map(({group,point:groupPoint})=>{
    const key=`${group.cellKey}:${group.part}:${group.items.map(item=>item.id).sort().join(':')}`;
    if(group.items.length===1){const item=group.items[0];const privatePlacement=item.current_signal_geometry_visible===false;return <Marker key={key} position={groupPoint} icon={truckMarker(item,false,zoom)} eventHandlers={{click:()=>onSelect(item.id)}}><Tooltip direction="top" offset={[0,zoom<=6?-76:-90]} opacity={1} className={`capacity-marker-tooltip ${item.status==='PARTIAL'?'partial':'empty'}`}>{item.cargo_configuration||'Truck'} · {item.status==='PARTIAL'?'Partial':'Empty'}<br/>{item.provider_name}<br/>{privatePlacement?'Regular service marker · not current location':item.availability_geometry==='RADIUS'?'Service area':'Capacity route'}<br/>{privatePlacement?'Select to call or request Shared capacity':'Select for details'}</Tooltip></Marker>;}
    if(zoom>=15){const center=map.project(groupPoint,zoom);const radius=Math.max(34,Math.min(58,group.items.length*7));return <React.Fragment key={key}>{group.items.map((item,index)=>{const angle=(Math.PI*2*index)/group.items.length;const point=map.unproject(L.point(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius),zoom);const privatePlacement=item.current_signal_geometry_visible===false;return <Marker key={item.id} position={point} icon={truckMarker(item,false,zoom)} eventHandlers={{click:()=>onSelect(item.id)}}><Tooltip direction="top" offset={[0,-90]} opacity={1} className={`capacity-marker-tooltip ${item.status==='PARTIAL'?'partial':'empty'}`}>{item.cargo_configuration||'Truck'} · {item.status==='PARTIAL'?'Partial':'Empty'}<br/>{item.provider_name}<br/>{privatePlacement?'Regular service marker · not current location':item.availability_geometry==='RADIUS'?'Service area':'Capacity route'}<br/>{privatePlacement?'Select to call or request Shared capacity':'Select for details'}</Tooltip></Marker>;})}</React.Fragment>;}
    const statusLabel=group.status==='PARTIAL'?'Partial':'Empty';
    const statusClass=group.status==='PARTIAL'?'partial':'empty';
    const icon=L.divIcon({className:`capacity-map-cluster ${statusClass}`,html:`<span>${group.items.length}</span><small>${statusLabel}</small>`,iconSize:[58,58],iconAnchor:[29,29]});
    return <Marker key={key} position={groupPoint} icon={icon} eventHandlers={{click:()=>map.setView(groupPoint,Math.min(15,zoom+2),{animate:false})}}><Tooltip direction="top" className={`capacity-marker-tooltip ${statusClass}`}>{group.items.length} {statusLabel} {group.items.length===1?'truck':'trucks'}<br/>Zoom in to see each truck</Tooltip></Marker>;
  })}</>;
}

export function PublicCapacityMapLeaflet({items,viewer,selectedId,onSelect}:{items:Signal[];viewer:Point|null;selectedId:string|null;onSelect:(id:string)=>void}){
  const selected=items.find(item=>item.id===selectedId)||null;
  const [hoveredInfo,setHoveredInfo]=React.useState(null as MapSignalInfo|null);
  const [pinnedInfo,setPinnedInfo]=React.useState(null as MapSignalInfo|null);
  React.useEffect(()=>{setHoveredInfo(null);setPinnedInfo(null);},[selectedId]);
  const availableLabel=selected?.status==='PARTIAL'?'Partial capacity':'Empty truck';
  const availabilityAccent:'empty'|'partial'=selected?.status==='PARTIAL'?'partial':'empty';
  const availabilityColorName=availabilityAccent==='partial'?'yellow':'green';
  const locationInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:location`,accent:'location',label:'Approximate location',title:'Where the truck may be',primary:`Within ${selected.location_precision_km||20} km`,detail:'The transporter chose this location accuracy. The truck is not shown at an exact point.'}:null;
  const radiusInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:area`,accent:availabilityAccent,label:'Service area',title:'Available now in this area',primary:`${selected.capacity_area_center_label||'Selected center'} · ${selected.capacity_area_boundary?.length||0} boundary cities · ${availableLabel}`,detail:`The ${availabilityColorName} polygon shows this truck’s current availability. Confirm location and cargo fit.`}:null;
  const routeInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:route`,accent:availabilityAccent,label:'Capacity route',title:'Available now on this route',primary:(selected.current_route_points||[]).map(point=>point.label).join(' → '),detail:`The ${availabilityColorName} route shows ${availableLabel.toLowerCase()}. Confirm pickup, delivery, timing, and fit.`}:null;
  const regularInfos:MapSignalInfo[]=(selected?.recurring_corridors||[]).slice(0,1).map(signal=>signal.geometry==='RADIUS'?{id:`${selected?.id}:regular:${signal.id}`,accent:'regular' as const,label:'Regular service area',title:signal.area_center_label||'Regular service area',primary:(signal.area_boundary||[]).map((point:PlacePoint)=>point.label).join(' · '),detail:'This is regular service, not current availability. Confirm the truck and timing.'}:{id:`${selected?.id}:regular:${signal.id}`,accent:'regular' as const,label:'Regular capacity route',title:'Regular two-way service',primary:(signal.route_points||[]).map((point:PlacePoint)=>point.label).join(' ↔ '),detail:'This is a regular route, not current availability. Confirm the truck and timing.'});
  const signalEvents=(info:MapSignalInfo)=>({
    mouseover:()=>{if(!pinnedInfo)setHoveredInfo(info);},
    mouseout:()=>{if(!pinnedInfo)setHoveredInfo(null);},
    click:(event:any)=>{L.DomEvent.stopPropagation(event.originalEvent);setHoveredInfo(null);setPinnedInfo(info);},
    add:(event:any)=>{
      const layer=event.target;
      const element=layer.getElement?.();
      if(!element)return;
      element.setAttribute('role','button');
      element.setAttribute('tabindex','0');
      element.setAttribute('aria-label',`${info.label}: ${info.primary}. ${info.detail}`);
      if(element.dataset.capacitySignalBound)return;
      element.dataset.capacitySignalBound='true';
      element.addEventListener('focus',()=>{if(!pinnedInfo)setHoveredInfo(info);});
      element.addEventListener('blur',()=>{if(!pinnedInfo)setHoveredInfo(null);});
      element.addEventListener('keydown',(keyboardEvent:KeyboardEvent)=>{if(keyboardEvent.key==='Enter'||keyboardEvent.key===' '){keyboardEvent.preventDefault();setHoveredInfo(null);setPinnedInfo(info);}});
    }
  });
  const currentSignalColor=availabilityAccent==='partial'?'#eab308':'#16a34a';
  const visibleSignalInfos=pinnedInfo?[pinnedInfo]:hoveredInfo?[hoveredInfo]:[];
  return <div className="public-capacity-map" aria-label="Map of available trucks">
    <MapContainer center={[9.1,40.2]} zoom={7} minZoom={5} maxZoom={15} maxBounds={EAST_AFRICA_MAP_BOUNDS} maxBoundsViscosity={0.85} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <ResizeMap/>
      <Bounds items={items} viewer={viewer} selectedId={selectedId}/>
      {viewer?<CircleMarker center={[viewer.lat,viewer.lng]} radius={8} pathOptions={{className:'public-viewer-location-marker',color:'#6d28d9',fillColor:'#8b5cf6',fillOpacity:1,weight:3}}><Tooltip direction="top" offset={[0,-10]} opacity={1} className="capacity-location-tooltip">Your location</Tooltip></CircleMarker>:null}
      {items.filter(item=>item.id===selectedId).map(item=><React.Fragment key={item.id}>
        {locationInfo&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.location_precision_km)||20)*1000} eventHandlers={signalEvents(locationInfo)} pathOptions={{className:'map-location-privacy-circle map-interactive-signal',color:'#7c3aed',weight:8,fill:false,dashArray:'7 7'}}/>:null}
        {radiusInfo&&item.status==='EMPTY'&&item.availability_geometry==='RADIUS'&&(item.capacity_area_boundary||[]).length>=3?<Polygon positions={(item.capacity_area_boundary||[]).map(point=>[point.lat,point.lng])} eventHandlers={signalEvents(radiusInfo)} pathOptions={{className:`map-service-area map-interactive-signal capacity-${availabilityAccent}`,color:currentSignalColor,weight:9,fill:false}}/>:null}
        {routeInfo&&item.availability_geometry==='ROUTE'&&(item.current_route_points||[]).length>=2?<OffsetPolyline positions={(item.current_route_points||[]).map(point=>[point.lat,point.lng])} offset={-6} eventHandlers={signalEvents(routeInfo)} pathOptions={{className:`map-current-route map-interactive-signal capacity-${availabilityAccent}`,color:currentSignalColor,weight:8,opacity:.95}}/>:null}
        {(item.recurring_corridors||[]).slice(0,1).map((signal,index)=>{const info=regularInfos[index];if(!info)return null;if(signal.geometry==='RADIUS'){const points=signal.area_boundary||[];if(points.length<3)return null;return <Polygon key={signal.id} positions={points.map((point:PlacePoint)=>[point.lat,point.lng])} eventHandlers={signalEvents(info)} pathOptions={{className:'map-regular-corridor map-interactive-signal',color:'#2563eb',weight:8,dashArray:'5 9',fill:false}}/>;}const points=signal.route_points||[];if(points.length<2)return null;return <OffsetPolyline key={signal.id} positions={points.map((point:PlacePoint)=>[point.lat,point.lng])} offset={6} eventHandlers={signalEvents(info)} pathOptions={{className:'map-regular-corridor map-interactive-signal',color:'#2563eb',weight:7,dashArray:'5 9',opacity:.9}}/>;})}
      </React.Fragment>)}
      <CapacityMarkers items={items} selectedId={selectedId} onSelect={onSelect}/>
    </MapContainer>
    <div className="ethiopia-map-label">Ethiopia market · East Africa view</div>
    {visibleSignalInfos.length?<section className={`capacity-signal-inspector${pinnedInfo?' pinned':''}`} aria-label={pinnedInfo?'Selected map signal':'Map signal details'} aria-live="polite">{pinnedInfo?<button type="button" onClick={()=>setPinnedInfo(null)} aria-label="Close map signal details">×</button>:null}{visibleSignalInfos.map(info=><article key={info.id} className={info.accent}><small>{info.label}</small><strong>{info.title}</strong><span>{info.primary}</span><em>{info.detail}</em></article>)}</section>:null}
    <div className="public-map-legend" aria-label="Map key"><span className="empty-status">Empty truck</span><span className="partial-status">Partial truck</span><span className="privacy">Approximate location</span><span className="radius">Empty service area</span><span className="empty-route">Empty capacity route</span><span className="partial-route">Partial capacity route</span><span className="corridor">Regular service</span></div>
  </div>;
}
