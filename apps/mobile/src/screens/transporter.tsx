import { AppLink } from '../components/app-link';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,View } from 'react-native';
import { usePublicQuery } from '../hooks/public-query';
import type { PublicProvider } from '../api/public-content';
import { Page,Title,Copy,Card,Button,ErrorText } from '../components/ui';
import { PublicBadges,PublicImage,ExternalButton } from '../components/public-details';
export default function TransporterScreen(){const {handle}=useLocalSearchParams<{handle:string}>();return <Profile key={String(handle)} handle={typeof handle==='string'?handle:''}/>;}
function Profile({handle}:{handle:string}){
 const [page,setPage]=useState(1),[showFleet,setShowFleet]=useState(false),query=usePublicQuery<PublicProvider>(`/api/mobile/public/providers/${encodeURIComponent(handle)}?page=${page}`),provider=query.data;
 return <Page><ErrorText message={query.error}/>{query.loading&&!provider&&<ActivityIndicator accessibilityLabel="Loading transporter"/>}{!!query.error&&<Button message="Try again" onPress={()=>{void query.reload();}}/>}
 {provider&&<><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><PublicImage path={provider.image} label={provider.name} portrait/><View style={{flex:1}}><Title>{provider.name}</Title><Copy>@{provider.handle}</Copy><Copy>{provider.kind} · {provider.city}</Copy></View></View>
 {!!provider.headline&&<Copy>{provider.headline}</Copy>}
 {!!provider.contacts.phone&&<ExternalButton label="Call transporter" url={`tel:${provider.contacts.phone}`}/>}
 {!!provider.contacts.whatsapp&&<ExternalButton label="WhatsApp" url={`https://wa.me/${provider.contacts.whatsapp.replace(/\D/g,'')}`}/>}
 {!!provider.contacts.email&&<ExternalButton label="Email transporter" url={`mailto:${provider.contacts.email}`}/>}
 {!!provider.contacts.website&&<ExternalButton label="Website" url={provider.contacts.website}/>}
 {!!provider.about&&<Card><Title message={"About this transporter"}/><Copy>{provider.about}</Copy>{!!provider.services&&<><Copy message={"Transport services"}/><Copy>{provider.services}</Copy></>}</Card>}
 {!provider.about&&!!provider.services&&<Card><Title message={"Transport services"}/><Copy>{provider.services}</Copy></Card>}
 {!!provider.youtubeId&&<ExternalButton label="Watch introduction" url={`https://www.youtube.com/watch?v=${provider.youtubeId}`}/>}
 <Card><Title message={"Documents"}/><PublicBadges items={provider.badges}/><Copy message={"A review applies to the named document, not a service guarantee."}/></Card>
 {provider.regular&&<Card><Title message={"Regular service"}/><Copy>{provider.regular.places.join(provider.regular.kind==='ROUTE'?' ↔ ':' · ')}</Copy><Copy>{provider.regular.kind==='ROUTE'?'Regular two-way route':'Regular service area'} · confirm availability</Copy></Card>}
 <Card><Title message={"Verified shipment reviews"}/>{provider.reviewCount>0&&<Copy>{provider.averageRating} / 5 · {provider.reviewCount} reviews</Copy>}{!provider.reviews.length&&<Copy message={"No verified shipment reviews yet."}/>}{provider.reviews.map((review,index)=><View key={index} style={{gap:6,paddingVertical:10}}><Copy>{review.rating} / 5 · {review.createdAt.slice(0,10)}{review.disputed?' · Under dispute':''}</Copy><Copy>{review.note}</Copy></View>)}</Card>
 {provider.fleet.total>1&&<Button secondary label={showFleet?'Hide trucks and drivers':`View trucks and drivers (${provider.fleet.total})`} onPress={()=>setShowFleet(!showFleet)}/>}
 {(showFleet||provider.fleet.total<=1)&&<><Title message={"Trucks and drivers"}/>{!provider.trucks.length&&<Copy message={"No trucks listed."}/>}{provider.trucks.map(truck=><Card key={truck.number}><PublicImage path={truck.image} label={truck.configuration}/><Title>{truck.name}</Title><Copy>{truck.configuration} · {truck.number}</Copy><Copy>{truck.driver?`${truck.driver} · ${truck.driverKind}`:'No driver listed'}</Copy>{!!truck.phone&&<ExternalButton label="Call driver" url={`tel:${truck.phone}`}/>}<Copy>{truck.capacity?`${truck.capacity.status==='EMPTY'?'Empty':'Partial capacity'} · ${truck.capacity.updated}`:'No current available capacity signal'}</Copy>{truck.capacity&&<><Copy>{[truck.capacity.origin,truck.capacity.destination].filter(Boolean).join(' → ')}</Copy><Copy>{truck.capacity.locationUpdated}</Copy><AppLink href={{pathname:'/',params:{q:provider.handle}}} style={{color:'#0c7275',paddingVertical:12}} message={"View capacity on map"}/></>}
 <Copy message={"Driver documents"}/><PublicBadges items={truck.driverBadges}/><Copy message={"Truck documents"}/><PublicBadges items={truck.truckBadges}/></Card>)}
 {provider.fleet.pages>1&&<><Copy>Page {provider.fleet.page} of {provider.fleet.pages}</Copy><Button secondary message="Previous trucks" disabled={page<=1||query.loading} onPress={()=>setPage(value=>value-1)}/><Button secondary message="Next trucks" disabled={page>=provider.fleet.pages||query.loading} onPress={()=>setPage(value=>value+1)}/></>}</>}
 </>}
 </Page>;
}
