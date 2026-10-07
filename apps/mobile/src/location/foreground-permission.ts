type Permission={granted:boolean};
type PermissionCapture<T>={read:()=>Promise<Permission>;request:()=>Promise<Permission>;capture:()=>Promise<T>};
// Permission UI can temporarily background Android. Capture begins only after
// consent returns and the caller confirms its screen is still active.
export async function authorizedForegroundCapture<T>(port:PermissionCapture<T>,mayRequest:boolean,ready:()=>void=()=>{}){
 const existing=await port.read();
 const permission=existing.granted||!mayRequest?existing:await port.request();
 if(!permission.granted)throw new Error('Allow location for Loadgistic in your phone settings, then try again.');
 ready();
 return port.capture();
}
