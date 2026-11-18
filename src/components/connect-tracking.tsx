'use client';
import React from 'react';
import {browserRequest} from '@/lib/browser-request';
import {useTrackingRequests,type SendTrackingRequest} from '@/lib/tracking-sessions/request-workflow';
import {Text} from './localization';

const send:SendTrackingRequest=async(command)=>{
 const {response,data}=await browserRequest<{ok:boolean;data:unknown}>('/api/tracking/requests',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)
 });
 if(!response.ok||!data.ok)throw Error();
 return data.data;
};

export function TrackingRequests({sessionId}:{sessionId?:string}){
 const w=useTrackingRequests(send,sessionId);
 const [locationId,setLocationId]=React.useState('');
 return <section className="card stack" aria-busy={w.busy}>
  <h3><Text message={sessionId?'Request a vehicle':'Tracking requests'}/></h3>
  {w.error?<p role="alert"><Text message="Could not load Tracking sessions. Please try again."/></p>:null}
  {sessionId?<><p>{w.target?.selected?<><Text message="Requested vehicle"/> · {w.target.selected}</>:null}</p>
   <form className="stack" onSubmit={e=>{e.preventDefault();void w.search();}}>
    <label><Text message="Truck number, driver or provider"/><input value={w.query} disabled={w.busy} onChange={e=>w.setQuery(e.target.value)} minLength={2} maxLength={100} required/></label>
    <button className="button secondary" disabled={w.busy||w.query.trim().length<2}><Text message="Search"/></button>
   </form>
   {w.target?.items.map(row=><button type="button" className="button secondary" key={row.vehicleId} disabled={w.busy} onClick={()=>void w.select(row)}>
    <Text message="Request tracking"/> · {row.label}{row.connected?<> · <Text message="In your network"/></>:null}
   </button>)}
   {w.target&&w.target.items.length===0&&w.searched&&!w.busy?<p><Text message="No trucks match your search."/></p>:null}
  </>:<>
   {!w.busy&&!w.error&&!w.incoming.length?<p><Text message="No pending tracking requests."/></p>:null}
   {w.incoming.map(row=><article className="stack" key={row.id}>
    <strong>{row.broker} · {row.reference}</strong><p>{row.cargo} · {row.vehicle}</p>
    <p>{row.route.map(p=>p.label).join(' → ')}</p><p>{[row.pickupDate,row.deliveryDate].filter(Boolean).join(' → ')}</p>
    <label><input type="checkbox" checked={locationId===row.id} onChange={e=>setLocationId(e.target.checked?row.id:'')}/> <Text message="Status and approximate location"/></label>
    <button className="button" type="button" disabled={w.busy} onClick={()=>void w.accept(row,locationId===row.id?'LOCATION_AND_STATUS':'STATUS_ONLY')}><Text message="Accept tracking request"/></button>
   </article>)}
   {w.shipment?<a className="button" href={'/app/provider-shipments/'+w.shipment}><Text message="Open Tracking"/></a>:null}
  </>}
  {w.busy?<p role="status"><Text message="Loading Tracking"/></p>:null}
  {(!sessionId||w.error)&&<button className="button secondary" type="button" disabled={w.busy} onClick={()=>void w.refresh()}><Text message="Refresh requests"/></button>}
 </section>;
}
