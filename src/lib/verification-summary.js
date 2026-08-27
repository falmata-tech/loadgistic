function ethiopiaDate(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date());
}

export function verificationBadgesFromApproved(subjectType,records=[]){
  const latestByType=new Map();
  for(const record of records||[]){
    if(record?.verification_type&&!latestByType.has(record.verification_type)){
      latestByType.set(record.verification_type,record);
    }
  }
  if(subjectType==='VEHICLE'){
    const record=latestByType.get('VEHICLE_AUTHORIZATION')||latestByType.get('VEHICLE_OWNERSHIP');
    const expired=Boolean(record?.expires_on&&record.expires_on<ethiopiaDate());
    return [{
      type:record?.verification_type||'VEHICLE_OWNERSHIP',verified:Boolean(record&&!expired),expired,
      reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null
    }];
  }
  const required=subjectType==='ORGANIZATION'
    ?['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']
    :['IDENTITY','DRIVER_IDENTITY'];
  return required.map(type=>{
    const record=latestByType.get(type);
    const expired=Boolean(record?.expires_on&&record.expires_on<ethiopiaDate());
    return {type,verified:Boolean(record&&!expired),expired,
      reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null};
  });
}

export function truckAuthorizationBadgeFromApproved(records,vehicleId,vehicleLabel){
  const record=(records||[]).find(item=>item?.verification_type==='VEHICLE_AUTHORIZATION'
    &&item?.related_vehicle_id===vehicleId);
  const expired=Boolean(record?.expires_on&&record.expires_on<ethiopiaDate());
  return {
    type:'TRUCK_AUTHORIZATION',verified:Boolean(record&&!expired),expired,
    reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null,
    vehicleId,vehicleLabel
  };
}
