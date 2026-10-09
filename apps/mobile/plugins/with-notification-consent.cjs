const {withAndroidManifest}=require('expo/config-plugins');
// Firebase must not upload an installation registration before alert opt-in.
module.exports=config=>withAndroidManifest(config,mod=>{
 const app=mod.modResults.manifest.application?.[0];
 if(!app)throw Error('ANDROID_APPLICATION_REQUIRED');
 const names=['firebase_messaging_auto_init_enabled','firebase_analytics_collection_enabled'];
 app['meta-data']=(app['meta-data']||[]).filter(item=>!names.includes(item.$?.['android:name']));
 for(const name of names)app['meta-data'].push({$:{'android:name':name,'android:value':'false'}});
 return mod;
});
