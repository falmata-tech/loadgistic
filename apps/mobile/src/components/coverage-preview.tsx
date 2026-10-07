import {useMemo,useState} from 'react';
import {View} from 'react-native';
import {Map,Camera,GeoJSONSource,Layer} from './map-platform';
import {coverageBounds,coverageGeometry} from '../map/coverage-preview';
import {mapStyle} from './map-style';
import {Copy,ErrorText} from './ui';
import {useLanguage} from '../localization/provider';
import type {Place} from './place-picker';
export function CoveragePreview({kind,places,regular=false}:{kind:string;places:Place[];regular?:boolean}){
 const {t}=useLanguage();
 const feature=useMemo(()=>coverageGeometry(kind,places),[kind,places]);
 const [failed,setFailed]=useState('');
 const signature=JSON.stringify(feature),color=regular?'#c06620':'#16845b';
 if(!feature)return <Copy message="Choose all cities to see the coverage preview."/>;
 return <View style={{gap:8}}><View style={{height:240,borderRadius:14,overflow:'hidden'}}>
  <Map key={signature} style={{flex:1}} androidView="texture" mapStyle={mapStyle} attribution onDidFailLoadingMap={()=>setFailed(signature)} onDidFinishLoadingMap={()=>setFailed('')}>
   <Camera initialViewState={{bounds:coverageBounds(feature),padding:{top:28,right:28,bottom:28,left:28}}}/>
   <GeoJSONSource id="coverage-preview" data={feature}>
    {feature.geometry.type==='Polygon'&&<Layer id="coverage-fill" type="fill" paint={{'fill-color':color,'fill-opacity':.12}}/>}
    <Layer id="coverage-outline" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':color,'line-width':4}}/>
   </GeoJSONSource>
  </Map>
 </View><Copy message="Coverage preview · not driving directions"/><ErrorText message={failed===signature?t('Map tiles could not load. Your selected cities are still available.'):''}/></View>;
}
