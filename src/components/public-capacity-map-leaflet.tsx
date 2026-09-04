"use client";

import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { BaseMapTiles } from '@/components/base-map-tiles';
import { buildCapacityMarkerGroups } from '@/lib/capacity-map-clustering';

type Point={lat:number;lng:number};
type PlacePoint={place_ref:string;label:string;lat:number;lng:number};
type Signal={id:string;provider_name:string;platform_number?:string;status:string;cargo_configuration?:string;availability_geometry?:string|null;current_signal_geometry_visible?:boolean;location_lat?:number;location_lng?:number;location_precision_km?:number;work_radius_km?:number;location_updated_at?:string|null;capacity_updated_label?:string;capacity_confirmation_needed?:boolean;location_updated_label?:string;location_is_last_reported?:boolean;capacity_area_center_label?:string;capacity_area_center_lat?:number;capacity_area_center_lng?:number;capacity_area_boundary?:PlacePoint[];current_route_points?:PlacePoint[];recurring_corridors?:any[]};
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

function ProgressiveCapacityLoader({onExplore}:{onExplore?:()=>void}){
  const explore=React.useRef(onExplore);
  const timer=React.useRef(0);
  React.useEffect(()=>{explore.current=onExplore;},[onExplore]);
  const schedule=React.useCallback(()=>{
    window.clearTimeout(timer.current);
    if(!explore.current)return;
    timer.current=window.setTimeout(()=>explore.current?.(),350);
  },[]);
  useMapEvents({moveend:schedule});
  React.useEffect(()=>{schedule();return()=>window.clearTimeout(timer.current);},[schedule]);
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

function Bounds({items,viewer,selectedId,keepItemsInView}:{items:Signal[];viewer:Point|null;selectedId:string|null;keepItemsInView:boolean}){
  const map=useMap();
  const fittedInitial=React.useRef(false);
  const fittedSelected=React.useRef('');
  const fittedViewer=React.useRef('');
  React.useEffect(()=>{
    if(!selectedId)fittedSelected.current='';
    const selected=items.find(item=>item.id===selectedId);
    if(selected){
      if(fittedSelected.current!==selected.id){
        const selectedBounds=L.latLngBounds([]);
        if(hasCoordinate(selected.location_lat)&&hasCoordinate(selected.location_lng))selectedBounds.extend(L.latLng(Number(selected.location_lat),Number(selected.location_lng)).toBounds(Math.max(Number(selected.location_precision_km)||20,selected.availability_geometry==='RADIUS'?Number(selected.work_radius_km)||50:0)*2200));
        (selected.current_route_points||[]).forEach(point=>selectedBounds.extend([point.lat,point.lng]));
        (selected.capacity_area_boundary||[]).forEach(point=>selectedBounds.extend([point.lat,point.lng]));
        if(viewer)selectedBounds.extend([viewer.lat,viewer.lng]);
        if(selectedBounds.isValid()){fittedSelected.current=selected.id;map.fitBounds(selectedBounds,{padding:[48,48],maxZoom:12,animate:false});}
      }
      return;
    }
    const viewerKey=viewer?`${viewer.lat.toFixed(4)}:${viewer.lng.toFixed(4)}`:'';
    if(viewer){
      if(fittedViewer.current!==viewerKey){
        fittedViewer.current=viewerKey;
        if(keepItemsInView){
          const filteredBounds=L.latLngBounds([[viewer.lat,viewer.lng]]);
          for(const item of items)if(hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))filteredBounds.extend([Number(item.location_lat),Number(item.location_lng)]);
          map.fitBounds(filteredBounds,{padding:[36,36],maxZoom:9,animate:false});
        }else map.fitBounds(L.latLng(viewer.lat,viewer.lng).toBounds(100_000),{padding:[28,28],maxZoom:9,animate:false});
      }
      return;
    }
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
  },[items,keepItemsInView,map,selectedId,viewer]);
  return null;
}

function truckMarker(item:Signal,selected=false,zoom=10,visualOffset:[number,number]=[0,0]){
  const partial=item.status==='PARTIAL';
  const statusClass=partial?'partial':'empty';
  const trailerConfiguration=item.cargo_configuration==='Heavy Rigid Stake Body Truck + Trailer';
  const image=vehicleConfigurationImage(item.cargo_configuration);
  const size:[number,number]=selected?[104,120]:zoom<=6?[64,75]:zoom<=8?[72,84]:[88,102];
  return L.divIcon({className:`capacity-truck-map-marker vehicle-image-marker ${statusClass}${trailerConfiguration?' trailer-configuration':''}${selected?' selected':''}`,html:`<span class="vehicle-marker-image"><span class="vehicle-marker-content"><img src="${image}" alt=""/></span></span>`,iconSize:size,iconAnchor:[size[0]/2-visualOffset[0],size[1]-visualOffset[1]]});
}

function truckMarkerAccessibleLabel(item:Signal){
  const status=item.status==='PARTIAL'?'Partial capacity':'Empty truck';
  return `${item.cargo_configuration||'Truck'} · ${status} · ${item.provider_name}`;
}

function routePointAtFraction(points:PlacePoint[],fraction:number):[number,number]|null{
  if(points.length<2)return null;
  const lengths=points.slice(1).map((point,index)=>L.latLng(points[index].lat,points[index].lng).distanceTo(L.latLng(point.lat,point.lng)));
  const total=lengths.reduce((sum,length)=>sum+length,0);
  if(!total)return [points[0].lat,points[0].lng];
  let remaining=total*Math.max(0,Math.min(1,fraction));
  for(let index=0;index<lengths.length;index+=1){
    if(remaining<=lengths[index]){const ratio=remaining/lengths[index];return [points[index].lat+(points[index+1].lat-points[index].lat)*ratio,points[index].lng+(points[index+1].lng-points[index].lng)*ratio];}
    remaining-=lengths[index];
  }
  return [points.at(-1)!.lat,points.at(-1)!.lng];
}

function routeMidpoint(points:PlacePoint[]):[number,number]|null{return routePointAtFraction(points,.5);}

function markerPoint(item:Signal):[number,number]|null{
  if(item.current_signal_geometry_visible!==false&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng))return [Number(item.location_lat),Number(item.location_lng)];
  if(item.current_signal_geometry_visible!==false&&item.availability_geometry==='ROUTE'&&(item.current_route_points||[]).length>=2)return routeMidpoint(item.current_route_points||[]);
  return null;
}

function CapacityMarkers({items,selectedId,onSelect}:{items:Signal[];selectedId:string|null;onSelect:(id:string)=>void}){
  const map=useMap();
  const [revision,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),moveend:()=>setRevision((value:number)=>value+1)});
  const selected=items.find(item=>item.id===selectedId);
  const zoom=map.getZoom();
  type MarkerGroup={key:string;status:'EMPTY'|'PARTIAL';memberIds:string[];anchor:{lat:number;lng:number};visualOffset:{x:number;y:number}};
  const clusteredGroups:MarkerGroup[]=React.useMemo(()=>{
    if(selected)return [] as MarkerGroup[];
    const entries=items.flatMap(item=>{
      const point=markerPoint(item);
      if(!point)return [];
      const pixel=map.project(point,zoom);
      return[{id:item.id,status:item.status,lat:point[0],lng:point[1],x:pixel.x,y:pixel.y}];
    });
    return buildCapacityMarkerGroups(entries,zoom) as MarkerGroup[];
  },[items,map,selected,zoom]) as MarkerGroup[];
  const groups:MarkerGroup[]=React.useMemo(()=>{
    const renderBounds=map.getBounds().pad(.35);
    return clusteredGroups.filter(group=>renderBounds.contains([group.anchor.lat,group.anchor.lng]));
  },[clusteredGroups,map,revision]) as MarkerGroup[];
  const itemById:Map<string,Signal>=React.useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]) as Map<string,Signal>;
  if(selected){const point=markerPoint(selected);return point?<Marker position={point} icon={truckMarker(selected,true)} zIndexOffset={2000} title={truckMarkerAccessibleLabel(selected)} alt={truckMarkerAccessibleLabel(selected)}/>:null;}
  return <>{groups.map(group=>{
    const groupItems=group.memberIds.map(id=>itemById.get(id)).filter((item):item is Signal=>Boolean(item));
    const groupPoint:[number,number]=[group.anchor.lat,group.anchor.lng];
    const visualOffset:[number,number]=[group.visualOffset.x,group.visualOffset.y];
    if(groupItems.length===1){const item=groupItems[0];const accessibleLabel=truckMarkerAccessibleLabel(item);return <Marker key={group.key} position={groupPoint} icon={truckMarker(item,false,zoom,visualOffset)} title={accessibleLabel} alt={accessibleLabel} eventHandlers={{click:()=>onSelect(item.id)}}><Tooltip direction="top" offset={[visualOffset[0],(zoom<=6?-84:-98)+visualOffset[1]]} opacity={1} className={`capacity-marker-tooltip ${item.status==='PARTIAL'?'partial':'empty'}`}>{item.cargo_configuration||'Truck'} · {item.status==='PARTIAL'?'Partial':'Empty'}<br/>{item.provider_name}<br/>{item.capacity_updated_label||'Capacity update unavailable'}<br/>{item.location_updated_label||'Location update unavailable'}<br/>{item.capacity_confirmation_needed?'Call to confirm availability':item.availability_geometry==='RADIUS'?'Service area · select for details':'Capacity route · select for details'}</Tooltip></Marker>;}
    const statusLabel=group.status==='PARTIAL'?'Partial':'Empty';
    const statusClass=group.status==='PARTIAL'?'partial':'empty';
    const icon=L.divIcon({className:`capacity-map-cluster ${statusClass}`,html:`<span>${groupItems.length}</span><small>${statusLabel}</small>`,iconSize:[58,58],iconAnchor:[29-visualOffset[0],29-visualOffset[1]]});
    return <Marker key={group.key} position={groupPoint} icon={icon} eventHandlers={zoom<15?{click:()=>map.setView(groupPoint,Math.min(15,zoom+2),{animate:false})}:undefined}>
      <Tooltip direction="top" offset={visualOffset} className={`capacity-marker-tooltip ${statusClass}`}>{groupItems.length} {statusLabel} trucks<br/>{zoom<15?'Zoom in to separate nearby trucks':'Select this group to choose a truck'}</Tooltip>
      {zoom>=15?<Popup className={`capacity-cluster-picker ${statusClass}`} minWidth={240} maxWidth={300} autoPan={false}>
        <div className="capacity-cluster-picker-content" role="group" aria-label={`${statusLabel} trucks in this area`}>
          <strong>{groupItems.length} {statusLabel.toLowerCase()} trucks nearby</strong>
          <span>Select a truck to inspect its capacity.</span>
          <div>{groupItems.map(item=><button key={item.id} type="button" onClick={()=>onSelect(item.id)}><b>{item.cargo_configuration||'Truck'}</b><small>{item.provider_name}</small></button>)}</div>
        </div>
      </Popup>:null}
    </Marker>;
  })}</>;
}

export function PublicCapacityMapLeaflet({items,viewer,selectedId,keepItemsInView=false,onSelect,onExplore}:{items:Signal[];viewer:Point|null;selectedId:string|null;keepItemsInView?:boolean;onSelect:(id:string)=>void;onExplore?:()=>void}){
  const selected=items.find(item=>item.id===selectedId)||null;
  const [hoveredInfo,setHoveredInfo]=React.useState(null as MapSignalInfo|null);
  const [pinnedInfo,setPinnedInfo]=React.useState(null as MapSignalInfo|null);
  const [legendOpen,setLegendOpen]=React.useState(()=>typeof window!=='undefined'&&window.matchMedia('(min-width: 761px)').matches);
  React.useEffect(()=>{setHoveredInfo(null);setPinnedInfo(null);},[selectedId]);
  const availableLabel=selected?.status==='PARTIAL'?'Partial capacity':'Empty truck';
  const availabilityAccent:'empty'|'partial'=selected?.status==='PARTIAL'?'partial':'empty';
  const availabilityColorName=availabilityAccent==='partial'?'yellow':'green';
  const locationInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:location`,accent:'location',label:selected.location_is_last_reported?'Last reported approximate location':'Approximate location',title:selected.location_is_last_reported?'Last reported truck area':'Where the truck may be',primary:`Within ${selected.location_precision_km||20} km · ${selected.location_updated_label||'Location update unavailable'}`,detail:'The transporter chose this location accuracy. This is not an exact or live position.'}:null;
  const radiusInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:area`,accent:availabilityAccent,label:'Service area',title:selected.capacity_confirmation_needed?'Reported Empty service area':'Latest Empty service area',primary:`${selected.capacity_area_center_label||'Selected center'} · ${selected.capacity_area_boundary?.length||0} boundary cities · ${selected.capacity_updated_label||'Capacity update unavailable'}`,detail:`The ${availabilityColorName} polygon shows this truck’s last published signal. Confirm location, availability, and cargo fit.`}:null;
  const routeInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:route`,accent:availabilityAccent,label:'Capacity route',title:selected.capacity_confirmation_needed?`Reported ${availableLabel.toLowerCase()} route`:`Latest ${availableLabel.toLowerCase()} route`,primary:`${(selected.current_route_points||[]).map(point=>point.label).join(' → ')} · ${selected.capacity_updated_label||'Capacity update unavailable'}`,detail:`The ${availabilityColorName} route shows the last published ${availableLabel.toLowerCase()} signal. Confirm pickup, delivery, timing, and fit.`}:null;
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
      <BaseMapTiles/>
      <ResizeMap/>
      <ProgressiveCapacityLoader onExplore={onExplore}/>
      <Bounds items={items} viewer={viewer} selectedId={selectedId} keepItemsInView={keepItemsInView}/>
      {viewer?<CircleMarker center={[viewer.lat,viewer.lng]} radius={8} pathOptions={{className:'public-viewer-location-marker',color:'#6d28d9',fillColor:'#8b5cf6',fillOpacity:1,weight:3}}><Tooltip direction="top" offset={[0,-10]} opacity={1} className="capacity-location-tooltip">Your location</Tooltip></CircleMarker>:null}
      {items.filter(item=>item.id===selectedId).map(item=><React.Fragment key={item.id}>
        {locationInfo&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.location_precision_km)||20)*1000} eventHandlers={signalEvents(locationInfo)} pathOptions={{className:'map-location-privacy-circle map-interactive-signal',color:'#7c3aed',weight:8,fill:false,dashArray:'7 7'}}/>:null}
        {radiusInfo&&item.status==='EMPTY'&&item.availability_geometry==='RADIUS'&&(item.capacity_area_boundary||[]).length>=3?<Polygon positions={(item.capacity_area_boundary||[]).map(point=>[point.lat,point.lng])} eventHandlers={signalEvents(radiusInfo)} pathOptions={{className:`map-service-area map-interactive-signal capacity-${availabilityAccent}`,color:currentSignalColor,weight:9,fill:false}}/>:null}
        {routeInfo&&item.availability_geometry==='ROUTE'&&(item.current_route_points||[]).length>=2?<OffsetPolyline positions={(item.current_route_points||[]).map(point=>[point.lat,point.lng])} offset={-6} eventHandlers={signalEvents(routeInfo)} pathOptions={{className:`map-current-route map-interactive-signal capacity-${availabilityAccent}`,color:currentSignalColor,weight:8,opacity:.95}}/>:null}
        {(item.recurring_corridors||[]).slice(0,1).map((signal,index)=>{const info=regularInfos[index];if(!info)return null;if(signal.geometry==='RADIUS'){const points=signal.area_boundary||[];if(points.length<3)return null;return <Polygon key={signal.id} positions={points.map((point:PlacePoint)=>[point.lat,point.lng])} eventHandlers={signalEvents(info)} pathOptions={{className:'map-regular-corridor map-interactive-signal',color:'#2563eb',weight:8,dashArray:'5 9',fill:false}}/>;}const points=signal.route_points||[];if(points.length<2)return null;return <OffsetPolyline key={signal.id} positions={points.map((point:PlacePoint)=>[point.lat,point.lng])} offset={6} eventHandlers={signalEvents(info)} pathOptions={{className:'map-regular-corridor map-interactive-signal',color:'#2563eb',weight:7,dashArray:'5 9',opacity:.9}}/>;})}
      </React.Fragment>)}
      <CapacityMarkers items={items} selectedId={selectedId} onSelect={onSelect}/>
    </MapContainer>
    <div className="ethiopia-map-label">Ethiopia capacity · East Africa view</div>
    {visibleSignalInfos.length?<section className={`capacity-signal-inspector${pinnedInfo?' pinned':''}`} aria-label={pinnedInfo?'Selected map signal':'Map signal details'} aria-live="polite">{pinnedInfo?<button type="button" onClick={()=>setPinnedInfo(null)} aria-label="Close map signal details">×</button>:null}{visibleSignalInfos.map(info=><article key={info.id} className={info.accent}><small>{info.label}</small><strong>{info.title}</strong><span>{info.primary}</span><em>{info.detail}</em></article>)}</section>:null}
    <details className="public-map-legend" open={legendOpen} onToggle={event=>setLegendOpen(event.currentTarget.open)}><summary>Map key</summary><div className="public-map-legend-items"><span className="empty-status">Empty truck</span><span className="partial-status">Partial truck</span><span className="privacy">Approximate location</span><span className="radius">Empty service area</span><span className="empty-route">Empty capacity route</span><span className="partial-route">Partial capacity route</span><span className="corridor">Regular service</span></div></details>
  </div>;
}
