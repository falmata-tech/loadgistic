const revokedCodes=new Set(['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','bad_jwt','user_not_found']);
/** @param {((session: {access_token:string}) => Promise<void>) | undefined} beforeClose */
export async function closeNativeSession(auth,credentials,beforeClose=undefined){
 const {error,data}=await auth.setSession(credentials);
 if(error){if(revokedCodes.has(error.code)&&[400,401,403].includes(error.status))return;throw new Error('LOGOUT_UNCONFIRMED');}
 if(beforeClose)await beforeClose(data?.session||credentials);
 const result=await auth.signOut({scope:'local'});if(result.error)throw new Error('LOGOUT_UNCONFIRMED');
}
