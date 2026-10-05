"use client";


import {Text} from '@/components/localization';
import React from 'react';
import { Building2, Check, Phone, Save, UserRound } from 'lucide-react';
import { AsyncMemberSelect } from './async-member-select';

export function ShipmentPartiesForm({
  shipmentId,
  ownerPartyRole='SHIPPER',
  receiverFirstName='',
  receiverPhone=''
}:{
  shipmentId:string;
  ownerPartyRole?:string;
  receiverFirstName?:string;
  receiverPhone?:string;
}){
  const [role,setRole]=React.useState(ownerPartyRole==='RECEIVER'?'RECEIVER':'SHIPPER');
  const [counterpartyType,setCounterpartyType]=React.useState('ACCOUNT');
  const counterpartLabel=role==='SHIPPER'?'Receiver':'Shipper';

  return <form action={`/api/shipments/${shipmentId}/receiver-contact`} method="post" className="stack">
    <fieldset className="form-group"><legend><UserRound aria-hidden="true"/><Text message="Shipment owner is the"/></legend><div className="segmented-control"><label><input type="radio" name="ownerPartyRole" value="SHIPPER" checked={role==='SHIPPER'} onChange={()=>setRole('SHIPPER')}/><span><Text message="Shipper"/></span></label><label><input type="radio" name="ownerPartyRole" value="RECEIVER" checked={role==='RECEIVER'} onChange={()=>setRole('RECEIVER')}/><span><Text message="Receiver"/></span></label></div></fieldset>
    <fieldset className="form-group"><legend><Building2 aria-hidden="true"/>{counterpartLabel}</legend><div className="segmented-control"><label><input type="radio" name="counterpartyType" value="ACCOUNT" checked={counterpartyType==='ACCOUNT'} onChange={()=>setCounterpartyType('ACCOUNT')}/><span><Text message="Loadgistic"/></span></label><label><input type="radio" name="counterpartyType" value="EXTERNAL" checked={counterpartyType==='EXTERNAL'} onChange={()=>setCounterpartyType('EXTERNAL')}/><span><Text message="External"/></span></label></div></fieldset>
    {counterpartyType==='ACCOUNT'?<AsyncMemberSelect id="execution-counterparty" name="counterpartyRef" kind="BUSINESS" label={`${counterpartLabel} Business`} placeholder="Start typing a Business name" required/>:<div className="form-group"><label htmlFor="execution-counterparty-name"><Building2 aria-hidden="true"/>{counterpartLabel}<Text message=" name"/></label><input id="execution-counterparty-name" name="externalCounterpartyName" required/></div>}
    <div className="form-grid"><div className="form-group"><label htmlFor="receiver-first-name"><UserRound aria-hidden="true"/><Text message="Receiver first name"/></label><input id="receiver-first-name" name="receiverFirstName" defaultValue={receiverFirstName} required/></div><div className="form-group"><label htmlFor="receiver-phone"><Phone aria-hidden="true"/><Text message="Receiver phone"/></label><input id="receiver-phone" name="receiverPhone" type="tel" defaultValue={receiverPhone} required/></div></div>
    <button className="button icon-button-label"><Save aria-hidden="true"/><Text message="Save parties "/><Check aria-hidden="true"/></button>
  </form>;
}
