// The caller's session role alone is not authority for an external Auth mutation.
export async function requireTeamCreator(client,user){
  if(!user?.id||user.role!=='ADMIN')throw new Error('FORBIDDEN');
  const {data,error}=await client.from('profiles').select('id')
    .eq('id',user.id).eq('role','ADMIN').eq('active',true).maybeSingle();
  if(error||!data)throw new Error('FORBIDDEN');
}
