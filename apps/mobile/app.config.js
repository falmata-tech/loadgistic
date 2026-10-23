const fs=require('node:fs');
const path=require('node:path');
function hasPrivateCredential(value){
 if(!value||typeof value!=='object')return false;
 return Object.entries(value).some(([key,item])=>['private_key','private_key_id','client_email'].includes(key)
  ||key==='type'&&item==='service_account'||hasPrivateCredential(item));
}
module.exports=({config})=>{
 const file=path.join(__dirname,'google-services.json');let configured=false;
 if(fs.existsSync(file)){
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  if(value.project_info?.project_id!=='loadgistic-f082a'||String(value.project_info?.project_number)!=='59430603227'
   ||!value.client?.some(client=>client.client_info?.android_client_info?.package_name==='com.loadgistic.app')
   ||hasPrivateCredential(value))throw Error('LOADGISTIC_FIREBASE_CONFIG_MISMATCH');
  configured=true;
 }
 return {...config,android:{...config.android,...(configured?{googleServicesFile:'./google-services.json'}:{})},
  extra:{...config.extra,nativePushConfigured:configured,firebaseProjectId:'loadgistic-f082a'}};
};
