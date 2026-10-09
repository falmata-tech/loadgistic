import {createContext,forwardRef,useContext,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type PropsWithChildren} from 'react';
import {createPortal} from 'react-dom';
import {View,type StyleProp,type ViewStyle} from 'react-native';
import * as maplibre from 'maplibre-gl';
import {type Map as BrowserMap,type StyleSpecification,type LayerSpecification,type GeoJSONSource as BrowserSource,type CameraOptions,type FitBoundsOptions,type EaseToOptions} from 'maplibre-gl';
import type {Feature,GeoJSON} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {loadBrowserRaster,rasterProtocol} from '../map/browser-raster-request';

type Coordinate=[number,number];
export type ViewState={center:Coordinate;zoom:number;bearing:number;pitch:number};
type RegionEvent={nativeEvent:ViewState};
export type MapRef={queryRenderedFeatures:(options:{layers:string[]})=>Promise<Feature[]>};
export type CameraRef={fitBounds:(bounds:[number,number,number,number],options:FitBoundsOptions)=>void;jumpTo:(options:CameraOptions)=>void;easeTo:(options:EaseToOptions)=>void};
export type GeoJSONSourceRef={getClusterExpansionZoom:(id:number)=>Promise<number>};
type PressEvent={nativeEvent:{features:Feature[]};stopPropagation:()=>void};
const Context=createContext<BrowserMap|null>(null);
const SourceContext=createContext<string>('');
type MapProps=PropsWithChildren<{style?:StyleProp<ViewStyle>;mapStyle:StyleSpecification;attribution?:boolean;androidView?:string;onDidFinishLoadingMap?:()=>void;onDidFailLoadingMap?:()=>void;onDidFinishRenderingFrame?:()=>void;onRegionIsChanging?:(event:RegionEvent)=>void;onRegionDidChange?:(event:RegionEvent)=>void}>;

export const Map=forwardRef<MapRef,MapProps>(function BrowserMapView(props,ref){
 const node=useRef<HTMLDivElement>(null),instance=useRef<BrowserMap|null>(null),latest=useRef(props);
 useLayoutEffect(()=>{latest.current=props;},[props]);
 const [ready,setReady]=useState<BrowserMap|null>(null);
 useImperativeHandle(ref,()=>({queryRenderedFeatures:async({layers})=>{
  const map=instance.current;if(!map)return [];
  return map.queryRenderedFeatures(undefined,{layers:layers.filter(id=>Boolean(map.getLayer(id)))});
 }}),[]);
 useEffect(()=>{
  if(!node.current)return;
  let map:BrowserMap;
  try{maplibre.addProtocol(rasterProtocol,(params,controller)=>loadBrowserRaster(params.url,controller.signal));maplibre.setWorkerUrl('/__loadgistic-map-worker.js');maplibre.setWorkerCount(2);map=new maplibre.Map({container:node.current,style:latest.current.mapStyle,center:[39.5,9],zoom:5,attributionControl:latest.current.attribution?{compact:true}:false});}
  catch{latest.current.onDidFailLoadingMap?.();return;}
  instance.current=map;
  const region=():RegionEvent=>({nativeEvent:{center:map.getCenter().toArray() as Coordinate,zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}});
  map.on('load',()=>{setReady(map);latest.current.onDidFinishLoadingMap?.();});
  map.on('error',()=>latest.current.onDidFailLoadingMap?.());
  map.on('render',()=>latest.current.onDidFinishRenderingFrame?.());
  map.on('move',()=>latest.current.onRegionIsChanging?.(region()));
  map.on('moveend',()=>latest.current.onRegionDidChange?.(region()));
  const resize=new ResizeObserver(()=>map.resize());resize.observe(node.current);
  return()=>{resize.disconnect();instance.current=null;map.remove();};
 },[]);
 return <View style={[{position:'relative',minHeight:100,width:'100%',height:'100%',flex:1},props.style]}><div ref={node} style={{position:'absolute',inset:0}}/>{ready&&<Context.Provider value={ready}>{props.children}</Context.Provider>}</View>;
});

type CameraProps={initialViewState?:Partial<CameraOptions>&{bounds?:[number,number,number,number];padding?:FitBoundsOptions['padding']};maxZoom?:number};
export const Camera=forwardRef<CameraRef,CameraProps>(function BrowserCamera({initialViewState,maxZoom},ref){
 const map=useContext(Context),initial=useRef(initialViewState);
 useImperativeHandle(ref,()=>({fitBounds:(bounds,options)=>{map?.fitBounds(bounds,options);},jumpTo:options=>{map?.jumpTo(options);},easeTo:options=>{map?.easeTo(options);}}),[map]);
 useEffect(()=>{if(!map)return;if(maxZoom!==undefined)map.setMaxZoom(maxZoom);const view=initial.current;if(view?.bounds)map.fitBounds(view.bounds,{padding:view.padding,duration:0});else if(view){const {bounds:_,padding:__,...camera}=view;map.jumpTo(camera);}},[map,maxZoom]);
 return null;
});

type SourceProps=PropsWithChildren<{id:string;data:GeoJSON;cluster?:boolean;clusterRadius?:number;clusterMaxZoom?:number;onPress?:(event:PressEvent)=>void}>;
export const GeoJSONSource=forwardRef<GeoJSONSourceRef,SourceProps>(function BrowserGeoJSON(props,ref){
 const map=useContext(Context),[ready,setReady]=useState(false),initial=useRef(props),latest=useRef(props);
 useLayoutEffect(()=>{latest.current=props;},[props]);
 useImperativeHandle(ref,()=>({getClusterExpansionZoom:async id=>{const source=map?.getSource(props.id) as BrowserSource|undefined;if(!source)throw Error('Map not ready');return source.getClusterExpansionZoom(id);}}),[map,props.id]);
 useEffect(()=>{
  if(!map)return;const p=initial.current;
  map.addSource(props.id,{type:'geojson',data:p.data,cluster:p.cluster,clusterRadius:p.clusterRadius,clusterMaxZoom:p.clusterMaxZoom,maxzoom:Math.max(18,(p.clusterMaxZoom||17)+1)});let active=true;queueMicrotask(()=>{if(active)setReady(true);});
  const click=(event:maplibre.MapMouseEvent)=>{const layers=map.getStyle().layers.filter(layer=>'source' in layer&&layer.source===props.id).map(layer=>layer.id);if(!layers.length)return;const features=map.queryRenderedFeatures(event.point,{layers});if(features.length)latest.current.onPress?.({nativeEvent:{features},stopPropagation:()=>event.originalEvent.stopPropagation()});};
  map.on('click',click);
  return()=>{active=false;map.off('click',click);if(map.getStyle()){for(const layer of map.getStyle().layers)if('source' in layer&&layer.source===props.id)map.removeLayer(layer.id);if(map.getSource(props.id))map.removeSource(props.id);}};
 },[map,props.id]);
 useEffect(()=>{if(ready)(map?.getSource(props.id) as BrowserSource|undefined)?.setData(props.data);},[map,ready,props.id,props.data]);
 return ready?<SourceContext.Provider value={props.id}>{props.children}</SourceContext.Provider>:null;
});

type LayerProps={id:string;type:'line'|'fill'|'circle';filter?:unknown[];paint?:Record<string,unknown>;layout?:Record<string,unknown>};
export function Layer(props:LayerProps){
 const map=useContext(Context),source=useContext(SourceContext),initial=useRef(props);
 useEffect(()=>{if(!map||!source)return;map.addLayer({...initial.current,source} as LayerSpecification);return()=>{if(map.getLayer(props.id))map.removeLayer(props.id);};},[map,source,props.id]);
 const paint=JSON.stringify(props.paint),layout=JSON.stringify(props.layout),filter=JSON.stringify(props.filter);
 useEffect(()=>{if(!map?.getLayer(props.id))return;for(const [key,value]of Object.entries(JSON.parse(paint||'{}')))map.setPaintProperty(props.id,key as Parameters<BrowserMap['setPaintProperty']>[1],value as Parameters<BrowserMap['setPaintProperty']>[2]);for(const [key,value]of Object.entries(JSON.parse(layout||'{}')))map.setLayoutProperty(props.id,key as Parameters<BrowserMap['setLayoutProperty']>[1],value as Parameters<BrowserMap['setLayoutProperty']>[2]);if(filter)map.setFilter(props.id,JSON.parse(filter) as maplibre.FilterSpecification);},[map,props.id,paint,layout,filter]);
 return null;
}

export function Marker({id,lngLat,offset=[0,0],onPress,children}:PropsWithChildren<{id:string;lngLat:Coordinate;offset?:Coordinate;onPress?:()=>void}>){
 const map=useContext(Context);
 const [element]=useState(()=>{
  if(typeof document==='undefined')return null;
  const node=document.createElement('div');node.style.cursor='pointer';return node;
 });
 const marker=useRef<maplibre.Marker|null>(null),latest=useRef(onPress);
 const initial=useRef({lngLat,offset});
 useLayoutEffect(()=>{latest.current=onPress;},[onPress]);
 useEffect(()=>{
  if(!map||!element)return;
  element.setAttribute('data-marker-id',id);
  const click=(event:MouseEvent)=>{event.stopPropagation();latest.current?.();};
  element.addEventListener('click',click);
  const instance=new maplibre.Marker({element,offset:initial.current.offset}).setLngLat(initial.current.lngLat).addTo(map);
  marker.current=instance;
  return()=>{element.removeEventListener('click',click);instance.remove();marker.current=null;};
 },[map,element,id]);
 const [longitude,latitude]=lngLat,[offsetX,offsetY]=offset;
 useEffect(()=>{marker.current?.setLngLat([longitude,latitude]).setOffset([offsetX,offsetY]);},[longitude,latitude,offsetX,offsetY]);
 return element?createPortal(children,element):null;
}
