// Fictional tracker identifiers only. Never derive demo targets from customer data.
export const DEMO_DEVICES=Object.freeze([
 {imei:'990000000000001',protocol:'gt06',protocolDeviceId:'990000000000001',label:'Synthetic GPS one',latitude:9.031,longitude:38.748},
 {imei:'990000000000002',protocol:'gt06',protocolDeviceId:'990000000000002',label:'Synthetic GPS two',latitude:8.542,longitude:39.273}
]);
export function assertDemoDevice(imei){const device=DEMO_DEVICES.find(row=>row.imei===imei);if(!device)throw new Error('DEMO_DEVICE_NOT_ALLOWLISTED');return device;}
export function assertLoopback(value){const url=new URL(value);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('REMOTE_TELEMATICS_DEMO_REFUSED');return url;}
const originalEmails=Object.freeze({'user-admin':'admin@loadgistic.local','user-transporter':'transporter@loadgistic.local','user-driver':'driver@loadgistic.local'});
/** Marker plus exact fixture key and owner-authorized mailbox; never arbitrary users. */
export function assertDemoIdentity(user,fixtureKey){
 const original=originalEmails[fixtureKey],email=String(user?.email||'').toLowerCase();
 const ownerAlias=/^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$/.test(email);
 if(!original||user?.app_metadata?.fixture_source!=='loadgistic'||user?.user_metadata?.fixture_key!==fixtureKey
  ||!(email===original||ownerAlias||fixtureKey==='user-admin'&&email==='falmata.dawano@gmail.com'))throw new Error('DEMO_IDENTITY_NOT_ALLOWLISTED');
 return user;
}
