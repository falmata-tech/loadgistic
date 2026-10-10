import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {apkManifest,bundleManifest,forbiddenPermissions,requiredPermissions,verifyReleasePermissions} from '../scripts/verify-android-permissions.mjs';

const valid={packageName:'com.loadgistic.app',debuggable:false,permissions:requiredPermissions};
test('standalone release preserves actual shipment and alert permissions',()=>{
 assert.equal(verifyReleasePermissions(valid).requiredPermissionCount,requiredPermissions.length);
 for(const permission of requiredPermissions)assert.throws(()=>verifyReleasePermissions({...valid,permissions:requiredPermissions.filter(name=>name!==permission)}),/MISSING_RELEASE_PERMISSIONS/);
});
test('inherited unused permissions and developer artifacts fail the release gate',()=>{
 for(const permission of forbiddenPermissions)assert.throws(()=>verifyReleasePermissions({...valid,permissions:[...requiredPermissions,permission]}),/UNUSED_RELEASE_PERMISSIONS/);
 assert.throws(()=>verifyReleasePermissions({...valid,debuggable:true}),/STANDALONE_RELEASE_REQUIRED/);
 assert.throws(()=>verifyReleasePermissions({...valid,packageName:'another.app'}),/LOADGISTIC_PACKAGE_REQUIRED/);
});
test('APK inspection reads the compiled inventory including SDK-scoped additions',()=>{
 const badging="package: name='com.loadgistic.app' versionCode='5'\n"+requiredPermissions.map(name=>`uses-permission: name='${name}'`).join('\n');
 verifyReleasePermissions(apkManifest(badging));
 assert.throws(()=>verifyReleasePermissions(apkManifest(badging+"\nuses-permission-sdk-23: name='android.permission.SYSTEM_ALERT_WINDOW'")),/UNUSED_RELEASE_PERMISSIONS/);
 assert.throws(()=>verifyReleasePermissions(apkManifest(badging+'\napplication-debuggable')),/STANDALONE_RELEASE_REQUIRED/);
 assert.throws(()=>apkManifest('not an artifact manifest'),/COMPILED_APK_MANIFEST_REQUIRED/);
});
test('AAB inspection parses final XML and rejects malformed or unsafe manifests',async()=>{
 const prefix='<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.loadgistic.app">'+requiredPermissions.map(name=>`<uses-permission android:name="${name}"/>`).join('');
 verifyReleasePermissions(await bundleManifest(prefix+'<application/></manifest>'));
 assert.throws(()=>verifyReleasePermissions({...valid,permissions:[]}));
 const debug=await bundleManifest(prefix+'<application android:debuggable="true"/></manifest>');
 assert.throws(()=>verifyReleasePermissions(debug),/STANDALONE_RELEASE_REQUIRED/);
 const inherited=await bundleManifest(prefix+'<uses-permission-sdk-23 android:name="android.permission.SYSTEM_ALERT_WINDOW"/><application/></manifest>');
 assert.throws(()=>verifyReleasePermissions(inherited),/UNUSED_RELEASE_PERMISSIONS/);
 await assert.rejects(bundleManifest(prefix+'<application/>'),/Unclosed root tag/);
 await assert.rejects(bundleManifest('<manifest package="com.loadgistic.app"><application/><uses-permission/></manifest>'),/VALID_MANIFEST_PERMISSIONS_REQUIRED/);
});
test('standalone configuration blocks unused permissions without removing tracking',()=>{
 const config=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
 const blocked=new Set(config.android.blockedPermissions.map(name=>name.includes('.')?name:'android.permission.'+name));
 for(const name of forbiddenPermissions)assert.ok(blocked.has(name),'Missing release block: '+name);
 for(const name of requiredPermissions)assert.ok(!blocked.has(name),'Required permission blocked: '+name);
});
