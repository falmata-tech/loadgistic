import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const plugin=require('../plugins/with-notification-consent.cjs');
test('FCM startup cannot upload an installation before alert opt-in',async()=>{
 const config=plugin({name:'Loadgistic',slug:'loadgistic'});
 const result=await config.mods.android.manifest({modResults:{manifest:{application:[{'meta-data':[{$:{'android:name':'firebase_messaging_auto_init_enabled','android:value':'true'}},{$:{'android:name':'unrelated.setting','android:value':'keep'}}]}]}}});
 const rows=result.modResults.manifest.application[0]['meta-data'];
 for(const name of ['firebase_messaging_auto_init_enabled','firebase_analytics_collection_enabled'])assert.deepEqual(rows.filter(x=>x.$['android:name']===name),[{$:{'android:name':name,'android:value':'false'}}]);
 assert.equal(rows.find(x=>x.$['android:name']==='unrelated.setting').$['android:value'],'keep');
});
