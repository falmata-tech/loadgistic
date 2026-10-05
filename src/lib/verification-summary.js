function ethiopiaDate(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date());
}

export function documentReviewSummary(badges=[]){
  const reviewed=badges.filter(badge=>badge.verified&&!badge.expired).length;
  return {reviewed,total:badges.length,complete:badges.length>0&&reviewed===badges.length};
}

export function verificationBadgesFromApproved(subjectType,records=[]){
  const latestByType=new Map();
  for(const record of records||[]){
    if(record?.verification_type&&!latestByType.has(record.verification_type)){
      latestByType.set(record.verification_type,record);
    }
  }
  if(subjectType==='VEHICLE'){
    const types=['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION'].filter(type=>latestByType.has(type));
    return (types.length?types:['VEHICLE_AUTHORITY']).map(type=>{
      const record=latestByType.get(type),expired=Boolean(record?.expires_on&&record.expires_on<ethiopiaDate());
      return {type,verified:Boolean(record&&!expired),expired,
        reviewedAt:record?.reviewed_at||null,expiresOn:record?.expires_on||null};
    });
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

export function projectVerificationSubject(subject,requests=[]){
  const verificationTypes=subject.verification_types||[];
  const pending=requests.filter(request=>request.status==='PENDING'
    &&(request.subject_type===subject.subject_type&&request.subject_id===subject.subject_id&&verificationTypes.includes(request.verification_type)
      ||subject.subject_type==='VEHICLE'&&request.verification_type==='VEHICLE_AUTHORIZATION'&&request.related_vehicle_id===subject.subject_id));
  const documents=subject.approved_documents||[];
  const badges=verificationBadgesFromApproved(subject.subject_type,documents);
  const pairingAuthorization=subject.subject_type!=='VEHICLE'&&verificationTypes.includes('VEHICLE_AUTHORIZATION');
  const pairingBadges=pairingAuthorization
    ?(subject.vehicles||[]).map(vehicle=>truckAuthorizationBadgeFromApproved(documents,vehicle.id,vehicle.label)):[];
  const verifiedTypes=new Set(badges.filter(badge=>badge.verified).map(badge=>badge.type));
  const allowedTypes=verificationTypes.filter(type=>pairingAuthorization&&type==='VEHICLE_AUTHORIZATION'
    ?pairingBadges.some(badge=>!badge.verified&&!pending.some(request=>request.verification_type===type&&request.related_vehicle_id===badge.vehicleId))
    :!verifiedTypes.has(type)&&!pending.some(request=>request.verification_type===type));
  const vehicles=pairingAuthorization
    ?(subject.vehicles||[]).filter(vehicle=>!pairingBadges.find(badge=>badge.vehicleId===vehicle.id)?.verified
      &&!pending.some(request=>request.verification_type==='VEHICLE_AUTHORIZATION'&&request.related_vehicle_id===vehicle.id))
    :subject.vehicles||[];
  return {...subject,vehicles,verification_types:undefined,approved_documents:undefined,
    allowed_types:allowedTypes,pending_count:pending.length,badges:[...badges,...pairingBadges]};
}

/** Inputs have already been restricted to approved records for this authorized projection. */
export function truckDocumentBadges(vehicleRecords=[],pairingRecords=[],vehicleId,vehicleLabel){
  const direct=vehicleRecords.filter(record=>['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION'].includes(record?.verification_type));
  const pairing=pairingRecords.filter(record=>record?.verification_type==='VEHICLE_AUTHORIZATION'&&record.related_vehicle_id===vehicleId);
  const records=[...direct,...pairing].sort((a,b)=>{
    const aCurrent=!a.expires_on||a.expires_on>=ethiopiaDate(),bCurrent=!b.expires_on||b.expires_on>=ethiopiaDate();
    return Number(bCurrent)-Number(aCurrent)||String(b.reviewed_at||'').localeCompare(String(a.reviewed_at||''));
  });
  return verificationBadgesFromApproved('VEHICLE',records).map(badge=>({...badge,vehicleId,vehicleLabel}));
}
