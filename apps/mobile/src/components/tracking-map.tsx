import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer } from './map-platform';
import { mapStyle } from './map-style';
import { trackingAreaGeometry, type TrackingArea } from '../location/tracking-area';
import { Copy, ErrorText } from './ui';
import {coverageBounds,coverageGeometry} from '../map/coverage-preview';
import type {Place} from './place-picker';
export type MapCoverage={kind:string;places:Place[];partial:boolean};
export function TrackingMap({ location, coverage, regular=[], fill=false }: { location: TrackingArea; coverage?:MapCoverage;regular?:MapCoverage[];fill?:boolean }) {
 const geometry = useMemo(() => trackingAreaGeometry(location), [location]), [error, setError] = useState('');
 const route = useMemo(()=>coverage?coverageGeometry(coverage.kind,coverage.places):null,[coverage]);
 const regularShapes=useMemo(()=>regular.map(item=>coverageGeometry(item.kind,item.places)).filter(item=>item!==null),[regular]);
 if (!geometry) return <Copy message={"The reported area cannot be shown on the map."}/>;
 const points = geometry.geometry.coordinates[0], routeBounds=route?coverageBounds(route):null,regularBounds=regularShapes.map(shape=>coverageBounds(shape));
 const west = Math.min(...points.map(p => p[0]),routeBounds?.[0]??Infinity,...regularBounds.map(bounds=>bounds[0])), east = Math.max(...points.map(p => p[0]),routeBounds?.[2]??-Infinity,...regularBounds.map(bounds=>bounds[2])), south = Math.min(...points.map(p => p[1]),routeBounds?.[1]??Infinity,...regularBounds.map(bounds=>bounds[1])), north = Math.max(...points.map(p => p[1]),routeBounds?.[3]??-Infinity,...regularBounds.map(bounds=>bounds[3]));
 const color=coverage?.partial?'#e9b400':'#16845b';
 return <View style={fill?{flex:1}:{gap:8}}><View style={fill?{flex:1,overflow:'hidden'}:{height:280,borderRadius:14,overflow:'hidden'}}><Map key={`${location.latitude}:${location.longitude}:${location.radius}:${JSON.stringify(route)}:${JSON.stringify(regularShapes)}`} style={{flex:1}} androidView="texture" mapStyle={mapStyle} attribution onDidFailLoadingMap={() => setError('Map tiles could not load. The reported area and update time are shown above.')}><Camera initialViewState={{ bounds: [west, south, east, north], padding: { top: 28, right: 28, bottom: 28, left: 28 } }} /><GeoJSONSource id="tracking-area" data={geometry}><Layer id="tracking-area-fill" type="fill" paint={{ 'fill-color': '#1976ed', 'fill-opacity': 0.12 }} /><Layer id="tracking-area-outline" type="line" paint={{ 'line-color': '#1976ed', 'line-width': 3, 'line-dasharray': [2, 2] }} /></GeoJSONSource>{route&&<GeoJSONSource id="saved-capacity" data={route}>{route.geometry.type==='Polygon'&&<Layer id="saved-capacity-fill" type="fill" paint={{'fill-color':color,'fill-opacity':.1}}/>}<Layer id="saved-capacity-outline" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':color,'line-width':4}}/></GeoJSONSource>}{regularShapes.map((shape,index)=><GeoJSONSource key={index} id={`home-regular-${index}`} data={shape}><Layer id={`home-regular-line-${index}`} type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#b56326','line-width':3,'line-dasharray':[2,2]}}/></GeoJSONSource>)}</Map></View>{!fill&&<><Copy message={"The driver is somewhere within the blue area. This is not a precise location."}/>{route&&<Copy message="Coverage preview · not driving directions"/>}</>}<ErrorText message={error} /></View>;
}
