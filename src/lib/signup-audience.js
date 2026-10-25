export function signupAudience(value){
  return value==='PROVIDER'||value==='BUSINESS'?value:'EXISTING';
}

export function signupEntry(value){
  return value==='shared-capacity'?'shared-capacity':'';
}
