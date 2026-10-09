// A checkbox is a person's intent for one authenticated identity. Never carry
// that intent to another account while a policy request is still in flight.
export function contentConsentForActor(intent,actorId){
 return typeof actorId==='string'&&actorId.length>0&&intent?.actorId===actorId&&intent.checked===true;
}
