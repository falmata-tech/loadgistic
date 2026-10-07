const revokedCodes=new Set(['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','bad_jwt','user_not_found']);
export async function closeNativeSession(auth,credentials){
 const {error}=await auth.setSession(credentials);
 if(error){if(revokedCodes.has(error.code)&&[400,401,403].includes(error.status))return;throw new Error('LOGOUT_UNCONFIRMED');}
 const result=await auth.signOut({scope:'local'});if(result.error)throw new Error('LOGOUT_UNCONFIRMED');
}
