"use client";


import {Text,Localized,useTranslation} from '@/components/localization';
import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { isTrailerVehicleConfiguration, vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { BaseMapTiles } from '@/components/base-map-tiles';
import { buildCapacityMarkerGroups } from '@/lib/capacity-map-clustering';
import { offsetSignalPath,signalLaneZoom,signalLaneLimit } from '@/lib/map-signal-offset';
import {areaCamera} from '@/lib/workspace-area-navigation.js';
import {worldCapacityViewport} from '@/lib/capacity-viewport';
import {locationSourceLabel,locationSourceSvg,locationSourceColor} from '@/lib/location-source.js';
import sourceStyles from './location-source-badge.module.css';
import {localizedUpdateLabel} from '@/lib/i18n/update-label.js';

type Point={lat:number;lng:number};
type PlacePoint={place_ref:string;label:string;lat:number;lng:number};
type Signal={location_source?:string;location_is_demo?:boolean;accepts_full_load?:boolean|number;accepts_partial_load?:boolean|number;id:string;provider_name:string;platform_number?:string;status:string;cargo_configuration?:string;availability_geometry?:string|null;current_signal_geometry_visible?:boolean;location_lat?:number;location_lng?:number;location_precision_km?:number;work_radius_km?:number;location_updated_at?:string|null;capacity_updated_label?:string;capacity_confirmation_needed?:boolean;location_updated_label?:string;location_is_last_reported?:boolean;capacity_area_center_label?:string;capacity_area_center_lat?:number;capacity_area_center_lng?:number;capacity_area_boundary?:PlacePoint[];current_route_points?:PlacePoint[];recurring_corridors?:any[]};
type MapSignalInfo={id:string;accent:'truck'|'location'|'empty'|'partial'|'regular';label:string;title:string;primary:string;detail:string};
type SignalPath={positions:[number,number][];closed:boolean;offset:number};

function hasCoordinate(value:unknown){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}

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

function capacityViewport(map:L.Map){
  const bounds=map.getBounds().pad(0.1);
  return worldCapacityViewport([bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()]);
}

function ProgressiveCapacityLoader({onExplore}:{onExplore?:(bounds:number[])=>void}){
  const map=useMap();
  const explore=React.useRef(onExplore);
  const timer=React.useRef(0);
  React.useEffect(()=>{explore.current=onExplore;},[onExplore]);
  const schedule=React.useCallback(()=>{
    window.clearTimeout(timer.current);
    if(!explore.current)return;
    timer.current=window.setTimeout(()=>{
      explore.current?.(capacityViewport(map));
    },350);
  },[map]);
  useMapEvents({moveend:schedule,resize:schedule});
  React.useEffect(()=>{schedule();return()=>window.clearTimeout(timer.current);},[schedule]);
  return null;
}

function OffsetPolyline({positions,offset,closed=false,avoid,eventHandlers,pathOptions}:{positions:[number,number][];offset:number;closed?:boolean;avoid?:SignalPath;eventHandlers:L.LeafletEventHandlerFnMap;pathOptions:L.PathOptions}){
  const map=useMap();
  const [revision,setRevision]=React.useState(0);
  useMapEvents({zoomend:()=>setRevision((value:number)=>value+1),resize:()=>setRevision((value:number)=>value+1)});
  // The sibling Bounds effect can fit before this layer subscribes to zoomend.
  // Reconcile with that fitted view once, without waiting for a hover rerender.
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
  if(closed)return <Polygon positions={shifted} eventHandlers={eventHandlers} pathOptions={pathOptions}/>;
  return <Polyline positions={shifted} eventHandlers={eventHandlers} pathOptions={pathOptions}/>;
}


function restoredPublicCamera(enabled:boolean){
 if(!enabled)return null;
 try{
  if(sessionStorage.getItem('loadgistic:market-camera-return')!=='1')return null;
  sessionStorage.removeItem('loadgistic:market-camera-return');
  return areaCamera(JSON.parse(sessionStorage.getItem('loadgistic:market-camera')||'null'));
 }catch{return null;}
}
function RememberPublicCamera({enabled,selectedId}:{enabled:boolean;selectedId:string|null}){
 const map=useMap();
 useMapEvents({moveend:()=>{
  if(!enabled||selectedId)return;
  const center=map.getCenter(),lng=((center.lng+180)%360+360)%360-180;
  const camera=areaCamera({lat:center.lat,lng,zoom:map.getZoom()});
  if(camera)try{sessionStorage.setItem('loadgistic:market-camera',JSON.stringify(camera));}catch{}
 }});
 return null;
}

function Bounds({items,viewer,selectedId,keepItemsInView,restored=false}:{items:Signal[];viewer:Point|null;selectedId:string|null;keepItemsInView:boolean;restored?:boolean}){
  const map=useMap();
  const fittedInitial=React.useRef(restored);
  const fittedSelected=React.useRef('');
  const fittedViewer=React.useRef('');
  const previousView=React.useRef(null as {center:L.LatLng;zoom:number}|null);
  const pendingRestore=React.useRef(null as {center:L.LatLng;zoom:number}|null);
  const zoomInFlight=React.useRef(false);
  const restoreFrame=React.useRef(0);
  React.useEffect(()=>()=>cancelAnimationFrame(restoreFrame.current),[]);
  useMapEvents({
    zoomstart:()=>{zoomInFlight.current=true;},
    zoomend:()=>{
      zoomInFlight.current=false;
      const previous=pendingRestore.current;
      if(previous){pendingRestore.current=null;map.setView(previous.center,previous.zoom,{animate:false});}
    }
  });
  React.useEffect(()=>{
    if(!selectedId){
      fittedSelected.current='';
      if(previousView.current){
        const previous=previousView.current;previousView.current=null;
        fittedInitial.current=true;
        map.stop();pendingRestore.current=previous;
        // A zoom click may be queued for the next animation frame, or already
        // animating. Neither is cancelled by stop(). Let it start, then restore
        // after zoomend; without a zoom, restore on the next frame.
        cancelAnimationFrame(restoreFrame.current);
        restoreFrame.current=requestAnimationFrame(()=>{
          const pending=pendingRestore.current;
          if(pending&&!zoomInFlight.current){pendingRestore.current=null;map.setView(pending.center,pending.zoom,{animate:false});}
        });
        return;
      }
    }
    const selected=items.find(item=>item.id===selectedId);
    if(selected){
      if(pendingRestore.current&&!previousView.current)previousView.current=pendingRestore.current;
      pendingRestore.current=null;
      if(!previousView.current)previousView.current={center:map.getCenter(),zoom:map.getZoom()};
      if(fittedSelected.current!==selected.id){
        const selectedBounds=L.latLngBounds([]);
        if(selected.current_signal_geometry_visible!==false){
          if(hasCoordinate(selected.location_lat)&&hasCoordinate(selected.location_lng))selectedBounds.extend(L.latLng(Number(selected.location_lat),Number(selected.location_lng)).toBounds((Number(selected.location_precision_km)||20)*2200));
          (selected.current_route_points||[]).forEach(point=>selectedBounds.extend([point.lat,point.lng]));
          (selected.capacity_area_boundary||[]).forEach(point=>selectedBounds.extend([point.lat,point.lng]));
        }
        (selected.recurring_corridors||[]).slice(0,1).forEach(signal=>(signal.geometry==='RADIUS'?signal.area_boundary||[]:signal.route_points||[]).forEach((point:PlacePoint)=>selectedBounds.extend([point.lat,point.lng])));
        if(selectedBounds.isValid()){fittedSelected.current=selected.id;map.fitBounds(selectedBounds,{paddingTopLeft:[58,125],paddingBottomRight:[130,60],maxZoom:12,animate:false});}
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

function truckMarker(item:Signal,selected=false,zoom=10,visualOffset:[number,number]=[0,0],t:(text:string)=>string=text=>text){
  const partial=item.status==='PARTIAL';
  const statusClass=partial?'partial':'empty';
  const trailerConfiguration=isTrailerVehicleConfiguration(item.cargo_configuration);
  const image=vehicleConfigurationImage(item.cargo_configuration);
  const size:[number,number]=selected?[104,120]:zoom<=6?[64,75]:zoom<=8?[72,84]:[88,102];
  const source=hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?locationSourceLabel(item.location_source):'';
  const escaped=source?t(source).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!)):'';
  const badge=source?`<span class="${sourceStyles.badge}" style="color:${locationSourceColor(item.location_source)}" title="${escaped}">${locationSourceSvg(item.location_source)}</span>`:'';
  return L.divIcon({className:`capacity-truck-map-marker vehicle-image-marker ${statusClass}${trailerConfiguration?' trailer-configuration':''}${selected?' selected':''}`,html:`<span class="vehicle-marker-image"><span class="vehicle-marker-content"><img src="${image}" alt=""/></span>${badge}</span>`,iconSize:size,iconAnchor:[size[0]/2-visualOffset[0],size[1]-visualOffset[1]]});
}

function truckMarkerAccessibleLabel(item:Signal,t:(text:string)=>string=text=>text){
  const status=item.status==='PARTIAL'?'Partial capacity':'Empty vehicle';
  const source=hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?locationSourceLabel(item.location_source):'';
  return `${item.cargo_configuration||'Vehicle'} · ${status} · ${item.provider_name}${source?' · '+t(source):''}${hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)&&item.location_is_demo===true?' · '+t('Demo location'):''}`;
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

function markerActivation(activate:()=>void){
  return {click:activate,keydown:(event:L.LeafletKeyboardEvent)=>{
    if(event.originalEvent.key==='Enter'||event.originalEvent.key===' '){
      L.DomEvent.stop(event.originalEvent);activate();
    }
  }};
}

function CapacityMarkers({items,selectedId,onSelect,onDeselect}:{items:Signal[];selectedId:string|null;onSelect:(id:string)=>void;onDeselect:()=>void}){
  const {t}=useTranslation();
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
  if(selected){
    const point=markerPoint(selected);
    const exitIcon=L.divIcon({className:'capacity-truck-exit',html:'<span aria-hidden="true">×</span>',iconSize:[44,44],iconAnchor:[-27,110]});
    return point?<><Marker position={point} icon={truckMarker(selected,true,10,[0,0],t)} eventHandlers={markerActivation(()=>onSelect(selected.id))} zIndexOffset={2000} title={truckMarkerAccessibleLabel(selected,t)} alt={truckMarkerAccessibleLabel(selected,t)}/><Marker position={point} icon={exitIcon} eventHandlers={markerActivation(onDeselect)} zIndexOffset={2100} title={t('Back to map')} alt={t('Back to map')}/></>:null;
  }
  return <>{groups.map(group=>{
    const groupItems=group.memberIds.map(id=>itemById.get(id)).filter((item):item is Signal=>Boolean(item));
    const groupPoint:[number,number]=[group.anchor.lat,group.anchor.lng];
    const visualOffset:[number,number]=[group.visualOffset.x,group.visualOffset.y];
    if(groupItems.length===1){const item=groupItems[0];const accessibleLabel=truckMarkerAccessibleLabel(item,t);return <Marker key={group.key} position={groupPoint} icon={truckMarker(item,false,zoom,visualOffset,t)} title={accessibleLabel} alt={accessibleLabel} eventHandlers={markerActivation(()=>onSelect(item.id))}><Tooltip direction="top" offset={[visualOffset[0],(zoom<=6?-84:-98)+visualOffset[1]]} opacity={1} className={`capacity-marker-tooltip ${item.status==='PARTIAL'?'partial':'empty'}`}>{t(item.cargo_configuration||'Vehicle')} · {item.status==='PARTIAL'?<Text message="Partial"/>:<Text message="Empty"/>}<br/>{item.provider_name}<br/>{localizedUpdateLabel(item.capacity_updated_label,t)}<br/>{localizedUpdateLabel(item.location_updated_label,t,'location')}{item.location_is_demo===true?<> · <Text message="Demo location"/></>:null}<br/>{item.capacity_confirmation_needed?<Text message="Call to confirm availability"/>:item.availability_geometry==='RADIUS'?<Text message="Service area · select for details"/>:<Text message="Capacity route · select for details"/>}</Tooltip></Marker>;}
    const statusLabel=group.status==='PARTIAL'?'Partial':'Empty';
    const statusClass=group.status==='PARTIAL'?'partial':'empty';
    const icon=L.divIcon({className:`capacity-map-cluster ${statusClass}`,html:`<span>${groupItems.length}</span><small>${String(t(statusLabel)).replace(/[&<>]/g,(char:string)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;' } as Record<string,string>)[char])}</small>`,iconSize:[58,58],iconAnchor:[29-visualOffset[0],29-visualOffset[1]]});
    const countLabel=t(group.status==='PARTIAL'?'{count} vehicles with shared space':'{count} empty vehicles',{count:groupItems.length});
    return <Marker key={group.key} position={groupPoint} icon={icon} title={countLabel} eventHandlers={zoom<15?markerActivation(()=>map.setView(groupPoint,Math.min(15,zoom+2),{animate:false})):undefined}>
      <Tooltip direction="top" offset={visualOffset} className={`capacity-marker-tooltip ${statusClass}`}>{countLabel}<br/>{zoom<15?<Text message="Zoom in to separate nearby vehicles"/>:<Text message="Select this group to choose a vehicle"/>}</Tooltip>
      {zoom>=15?<Popup className={`capacity-cluster-picker ${statusClass}`} minWidth={240} maxWidth={300} autoPan={false}>
        <div className="capacity-cluster-picker-content" role="group" aria-label={countLabel}>
          <strong>{countLabel}</strong>
          <span><Text message="Select a vehicle to inspect its capacity."/></span>
          <div>{groupItems.map(item=><button key={item.id} type="button" onClick={()=>onSelect(item.id)}><b>{t(item.cargo_configuration||'Vehicle')}</b><small>{item.provider_name}</small></button>)}</div>
        </div>
      </Popup>:null}
    </Marker>;
  })}</>;
}

function SignalDetails({info,selected}:{info:MapSignalInfo;selected:Signal}){
  const {t}=useTranslation();
  const regular=info.accent==='regular';
  const signal=regular?selected.recurring_corridors?.[0]:null;
  const area=regular?signal?.geometry==='RADIUS':selected.availability_geometry==='RADIUS';
  const points:PlacePoint[]=regular?(area?signal?.area_boundary:signal?.route_points)||[]:(area?selected.capacity_area_boundary:selected.current_route_points)||[];
  if(info.accent==='location')return <article className="map-signal-details"><strong className="signal-summary"><Text message="Within {distance} km" values={{distance:selected.location_precision_km||20}}/></strong><p><Text message="The transporter chose this location accuracy. This is not an exact or live position."/></p><p>{locationSourceLabel(selected.location_source)?<Text message={locationSourceLabel(selected.location_source)}/>:null}</p><p className="signal-update">{selected.location_is_demo===true?<><Text message="Demo location"/> · </>:null}{localizedUpdateLabel(selected.location_updated_label,t,'location')}{selected.location_updated_at&&Number.isFinite(Date.parse(selected.location_updated_at))?<> · <time dateTime={selected.location_updated_at}>{new Date(selected.location_updated_at).toLocaleString()}</time></>:null}</p></article>;
  const explanation=area?'The outline marks the service area. These places define its boundary, not a trip.':regular?'This route is served in both directions. Contact the transporter to confirm availability.':'Follow the route in the order shown. Contact the driver to confirm pickup, delivery and available space.';
  return <article className="map-signal-details">
    {regular&&!area?<strong className="signal-summary"><Text message="Regular two-way service"/></strong>:null}
    {!regular?<span className="signal-capacity-status"><Text message={selected.status==='PARTIAL'?'Partial capacity':'Empty vehicle'}/></span>:null}
    <p><Text message={explanation}/></p>
    {area?<ul className="signal-area-places">{points.map((point,index)=><li key={index}>{point.label}</li>)}</ul>:<ol className="signal-route-stops">{points.map((point,index)=><li key={index}><span className="signal-stop-number" aria-hidden="true">{index+1}</span><span>{point.label}</span>{index<points.length-1?<span className="signal-route-direction" aria-hidden="true">{regular?'↕':'↓'}</span>:null}</li>)}</ol>}
    <p className="signal-update">{regular?<Text message="Regular service is not a current capacity update."/>:localizedUpdateLabel(selected.capacity_updated_label,t)}</p>
  </article>;
}

function MapInfoModal({accent,label,onClose,children}:{accent:MapSignalInfo['accent'];label:string;onClose:()=>void;children:React.ReactNode}){
  const dialog=React.useRef(null as HTMLDialogElement|null);
  const {t}=useTranslation();
  React.useEffect(()=>{
    const element=dialog.current;if(!element)return;
    const host=element.parentElement!;
    const previousFocus=document.activeElement as HTMLElement|null;
    const place=()=>{
      const box=host.getBoundingClientRect();
      const availableHeight=Math.max(0,window.innerHeight-32);
      const halfMinimum=Math.min(100,availableHeight)/2;
      const centreY=Math.max(16+halfMinimum,Math.min(box.top+box.height/2,window.innerHeight-16-halfMinimum));
      const maxHeight=Math.max(0,2*Math.min(centreY-16,window.innerHeight-16-centreY));
      element.style.left=`${box.left+box.width/2}px`;
      element.style.top=`${centreY}px`;
      element.style.maxHeight=`${maxHeight}px`;
      element.style.width=`${Math.min(accent==='truck'?540:430,box.width-32)}px`;
    };
    place();element.showModal();
    const observer=new ResizeObserver(place);observer.observe(host);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);element.close();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});};
  },[]);
  return <dialog ref={dialog} className={`capacity-info-card ${accent}`} style={{'--signal-color':signalColors[accent]} as React.CSSProperties} aria-label={t(label)} onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const targets=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(element=>element.getClientRects().length);
    const first=targets[0],last=targets.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}>{children}</dialog>;
}

const signalColors={truck:'#0c7275',location:'#1a73e8',empty:'#16a34a',partial:'#eab308',regular:'#c06620'};
export function PublicCapacityMapLeaflet({items,viewer,selectedId,rememberPublicView=false,keepItemsInView=false,onSelect,onDeselect,onExplore,truckDetails}:{items:Signal[];viewer:Point|null;selectedId:string|null;rememberPublicView?:boolean;keepItemsInView?:boolean;onSelect:(id:string)=>void;onDeselect:()=>void;onExplore?:(bounds:number[])=>void;truckDetails?:React.ReactNode}){
  const {t}=useTranslation();
  const [restoredView]=React.useState(()=>restoredPublicCamera(rememberPublicView));
  const selected=items.find(item=>item.id===selectedId)||null;
  const [pinnedInfo,setPinnedInfo]=React.useState(null as MapSignalInfo|null);
  const [legendOpen,setLegendOpen]=React.useState(false);
  React.useEffect(()=>{setPinnedInfo(null);},[selectedId]);
  const availabilityAccent:'empty'|'partial'=selected?.status==='PARTIAL'?'partial':'empty';
  const locationInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:location`,accent:'location',label:selected.location_is_last_reported?'Last reported approximate location':'Approximate location',title:selected.location_is_last_reported?'Last reported vehicle area':'Where the vehicle may be',primary:t('Within {distance} km · {update}',{distance:selected.location_precision_km||20,update:localizedUpdateLabel(selected.location_updated_label,t,'location')}),detail:t('The transporter chose this location accuracy. This is not an exact or live position.')}:null;
  const radiusInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:area`,accent:availabilityAccent,label:'Service area',title:selected.capacity_confirmation_needed?'Reported Empty service area':'Latest Empty service area',primary:t('{center} · {count} boundary cities · {update}',{center:selected.capacity_area_center_label||t('Selected center'),count:selected.capacity_area_boundary?.length||0,update:localizedUpdateLabel(selected.capacity_updated_label,t)}),detail:t('The outlined area shows where this vehicle can serve. Confirm its location, availability and cargo fit.')}:null;
  const routeInfo:MapSignalInfo|null=selected&&selected.current_signal_geometry_visible!==false?{id:`${selected.id}:route`,accent:availabilityAccent,label:'Capacity route',title:selected.capacity_confirmation_needed?'Reported capacity route':'Latest capacity route',primary:t('{route} · {update}',{route:(selected.current_route_points||[]).map(point=>point.label).join(' → '),update:localizedUpdateLabel(selected.capacity_updated_label,t)}),detail:t('This route is the vehicle’s last published capacity signal. Confirm pickup, delivery, timing and cargo fit.')}:null;
  const regularInfos:MapSignalInfo[]=(selected?.recurring_corridors||[]).slice(0,1).map(signal=>signal.geometry==='RADIUS'?{id:`${selected?.id}:regular:${signal.id}`,accent:'regular' as const,label:'Regular service area',title:signal.area_center_label||'Regular service area',primary:(signal.area_boundary||[]).map((point:PlacePoint)=>point.label).join(' · '),detail:'This is regular service, not current availability. Confirm the vehicle and timing.'}:{id:`${selected?.id}:regular:${signal.id}`,accent:'regular' as const,label:'Regular capacity route',title:'Regular two-way service',primary:(signal.route_points||[]).map((point:PlacePoint)=>point.label).join(' ↔ '),detail:'This is a regular route, not current availability. Confirm the vehicle and timing.'});
  const signalEvents=(info:MapSignalInfo)=>({
    click:(event:any)=>{L.DomEvent.stopPropagation(event);setPinnedInfo(info);},
    // Adjacent touch inspections can be recognized as a double tap by Leaflet.
    // Consume that gesture on the signal, preserving background double-tap zoom.
    dblclick:(event:any)=>{L.DomEvent.stopPropagation(event);L.DomEvent.preventDefault(event.originalEvent);},
    add:(event:any)=>{
      const layer=event.target;
      const element=layer.getElement?.();
      if(!element)return;
      element.setAttribute('role','button');
      element.setAttribute('tabindex','0');
      element.setAttribute('aria-label',t('{label}: {summary}. {detail}',{label:t(info.label),summary:info.primary,detail:info.detail}));
      if(element.dataset.capacitySignalBound)return;
      element.dataset.capacitySignalBound='true';
      element.addEventListener('keydown',(keyboardEvent:KeyboardEvent)=>{if(keyboardEvent.key==='Enter'||keyboardEvent.key===' '){keyboardEvent.preventDefault();setPinnedInfo(info);}});
    }
  });
  const currentSignalColor=availabilityAccent==='partial'?'#eab308':'#16a34a';
  const currentPoints=selected?.availability_geometry==='ROUTE'?selected.current_route_points:selected?.status==='EMPTY'?selected?.capacity_area_boundary:undefined;
  const currentClosed=selected?.availability_geometry==='RADIUS'||Boolean(currentPoints?.length&&currentPoints[0].lat===currentPoints.at(-1)?.lat&&currentPoints[0].lng===currentPoints.at(-1)?.lng);
  const currentPath:SignalPath|undefined=selected?.current_signal_geometry_visible!==false&&currentPoints&&currentPoints.length>=2?{positions:currentPoints.map(point=>[point.lat,point.lng]),closed:currentClosed,offset:currentClosed?-12:-6}:undefined;
  const truckInfo:MapSignalInfo|null=selected?{id:`${selected.id}:truck`,accent:'truck',label:'Vehicle details',title:'Vehicle details',primary:'',detail:''}:null;
  const infoChoices:MapSignalInfo[]=[];
  if(truckInfo)infoChoices.push(truckInfo);
  if(locationInfo&&selected&&hasCoordinate(selected.location_lat)&&hasCoordinate(selected.location_lng))infoChoices.push(locationInfo);
  if(currentPath&&currentPath.positions.length>=(currentPath.closed?3:2))infoChoices.push((selected?.availability_geometry==='RADIUS'?radiusInfo:routeInfo)!);
  (selected?.recurring_corridors||[]).slice(0,1).forEach((signal,index)=>{const closed=signal.geometry==='RADIUS',points=closed?signal.area_boundary:signal.route_points;if(points?.length>=(closed?3:2))infoChoices.push(regularInfos[index]);});
  const shortLabel=(info:MapSignalInfo)=>info.accent==='truck'?'Vehicle':info.accent==='location'?'Location':info.accent==='regular'?'Regular service':'Capacity';
  const activeInfo:MapSignalInfo|null=pinnedInfo&&selected&&pinnedInfo.id.startsWith(`${selected.id}:`)?pinnedInfo:null;
  return <Localized as="div" copy={["aria-label"]} className="public-capacity-map" aria-label="Map of available vehicles" onKeyDown={(event:React.KeyboardEvent<HTMLDivElement>)=>{if(event.key==='Escape'&&activeInfo){event.stopPropagation();setPinnedInfo(null);}}}>
    <MapContainer center={restoredView?[restoredView.lat,restoredView.lng]:[9.1,40.2]} zoom={restoredView?.zoom||7} minZoom={2} maxZoom={15} scrollWheelZoom>
      <BaseMapTiles/>
      <ResizeMap/>
      <ProgressiveCapacityLoader onExplore={onExplore}/>
      <RememberPublicCamera enabled={rememberPublicView} selectedId={selectedId}/><Bounds restored={Boolean(restoredView)} items={items} viewer={viewer} selectedId={selectedId} keepItemsInView={keepItemsInView}/>
      {viewer?<CircleMarker center={[viewer.lat,viewer.lng]} radius={8} pathOptions={{className:'public-viewer-location-marker',color:'#fff',fillColor:'#1a73e8',fillOpacity:1,weight:3}}><Tooltip direction="top" offset={[0,-10]} opacity={1} className="capacity-location-tooltip"><Text message="Your location"/></Tooltip></CircleMarker>:null}
      {items.filter(item=>item.id===selectedId).map(item=><React.Fragment key={item.id}>
        {locationInfo&&hasCoordinate(item.location_lat)&&hasCoordinate(item.location_lng)?<Circle center={[Number(item.location_lat),Number(item.location_lng)]} radius={(Number(item.location_precision_km)||20)*1000} eventHandlers={signalEvents(locationInfo)} pathOptions={{className:'map-location-privacy-circle map-interactive-signal',color:'#1a73e8',weight:8,fill:false,dashArray:'7 7'}}/>:null}
        {radiusInfo&&item.status==='EMPTY'&&item.availability_geometry==='RADIUS'&&(item.capacity_area_boundary||[]).length>=3?<OffsetPolyline closed offset={-12} positions={(item.capacity_area_boundary||[]).map(point=>[point.lat,point.lng])} eventHandlers={signalEvents(radiusInfo)} pathOptions={{className:`map-service-area map-interactive-signal capacity-${availabilityAccent}`,color:currentSignalColor,weight:9,fill:false}}/>:null}
        {routeInfo&&item.availability_geometry==='ROUTE'&&(item.current_route_points||[]).length>=2?<OffsetPolyline positions={(item.current_route_points||[]).map(point=>[point.lat,point.lng])} offset={-6} eventHandlers={signalEvents(routeInfo)} pathOptions={{className:`map-current-route map-interactive-signal capacity-${availabilityAccent}`,color:currentSignalColor,weight:8,opacity:.95}}/>:null}
        {(item.recurring_corridors||[]).slice(0,1).map((signal,index)=>{const info=regularInfos[index];if(!info)return null;if(signal.geometry==='RADIUS'){const points=signal.area_boundary||[];if(points.length<3)return null;return <OffsetPolyline avoid={currentPath} closed offset={12} key={signal.id} positions={points.map((point:PlacePoint)=>[point.lat,point.lng])} eventHandlers={signalEvents(info)} pathOptions={{className:'map-regular-corridor map-interactive-signal',color:'#c06620',weight:8,dashArray:'5 9',fill:false}}/>;}const points=signal.route_points||[];if(points.length<2)return null;return <OffsetPolyline avoid={currentPath} key={signal.id} positions={points.map((point:PlacePoint)=>[point.lat,point.lng])} offset={6} eventHandlers={signalEvents(info)} pathOptions={{className:'map-regular-corridor map-interactive-signal',color:'#c06620',weight:7,dashArray:'5 9',opacity:.9}}/>;})}
      </React.Fragment>)}
      <CapacityMarkers items={items} selectedId={selectedId} onDeselect={onDeselect} onSelect={id=>{if(id===selectedId&&truckInfo)setPinnedInfo(truckInfo);else onSelect(id);}}/>

    </MapContainer>
    {selected&&!markerPoint(selected)?<Localized as="button" copy={["aria-label"]} type="button" className="capacity-truck-exit map-selection-exit-fallback" aria-label="Back to map" onClick={onDeselect}>×</Localized>:null}
    {infoChoices.length?<Localized as="div" copy={["aria-label"]} className="map-info-controls" role="group" aria-label="Map details">{infoChoices.map(info=><Localized as="button" copy={["aria-label"]} key={info.id} type="button" className={`map-info-bubble ${info.accent}`} style={{'--signal-color':signalColors[info.accent]} as React.CSSProperties} aria-label={info.label} aria-pressed={activeInfo?.id===info.id} onClick={()=>setPinnedInfo(info)}><span><Text message={shortLabel(info)}/></span><b aria-hidden="true">…</b></Localized>)}</Localized>:null}
    {activeInfo?<MapInfoModal accent={activeInfo.accent} label={activeInfo.label} onClose={()=>setPinnedInfo(null)}>
      <header><strong><Text message={activeInfo.label}/></strong><Localized as="button" copy={["aria-label"]} type="button" aria-label="Close map signal details" onClick={()=>setPinnedInfo(null)}>×</Localized></header>
      <div className="capacity-info-content" tabIndex={0}>{activeInfo.accent==='truck'?truckDetails:<SignalDetails info={activeInfo} selected={selected!}/>}</div>
    </MapInfoModal>:null}


    <details className="public-map-legend" open={legendOpen} onToggle={event=>setLegendOpen(event.currentTarget.open)}><summary><Text message="Map key"/></summary><div className="public-map-legend-items"><span className="empty-status"><Text message="Empty vehicle"/></span><span className="partial-status"><Text message="Partial vehicle"/></span><span className="privacy"><Text message="Approximate location"/></span><span className="radius"><Text message="Empty service area"/></span><span className="empty-route"><Text message="Empty capacity route"/></span><span className="partial-route"><Text message="Partial capacity route"/></span><span className="corridor"><Text message="Regular service"/></span></div></details>
  </Localized>;
}
