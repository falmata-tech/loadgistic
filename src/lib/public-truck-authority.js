// This projection also runs in Expo. Keep it dependency-free and never spread
// private authority reviews, source records, beneficiary IDs or holder names.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(value)?value:null;
function fact(value){
  const row=object(value),verified=row.verified===true;
  return {verified,reviewedAt:verified?date(row.reviewedAt):null,expiresOn:verified?date(row.expiresOn):null};
}
export function publicTruckAuthority(value){
  const row=object(value),ownership=fact(row.ownership),permission=fact(row.permission),licence=object(row.operatingLicence);
  const holderBasis=['OWNED','FINANCED'].includes(licence.holderBasis)?licence.holderBasis:null;
  const operatingLicence={...fact(licence),holderBasis:licence.verified===true?holderBasis:null};
  return {ownership,permission,operatingLicence,qualifiesProvider:ownership.verified||operatingLicence.verified&&holderBasis!==null};
}
export function publicProviderAuthoritySummary(value){
  const row=object(value),keys=['total','ownershipVerified','operatingLicenceVerified','financedVerified','permissionVerified','notYetVerified'];
  if(keys.some(key=>!Number.isSafeInteger(row[key])||row[key]<0)
    ||row.total!==row.ownershipVerified+row.operatingLicenceVerified+row.permissionVerified+row.notYetVerified
    ||row.financedVerified>row.operatingLicenceVerified)return null;
  return Object.fromEntries(keys.map(key=>[key,row[key]]));
}
