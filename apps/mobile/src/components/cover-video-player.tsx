import Constants from 'expo-constants';
import {Platform} from 'react-native';
import {WebView} from 'react-native-webview';
import {coverEmbedUrl,coverPlayerOrigin,coverPlayerPermissions,coverPlayerResult,coverPlayerSubscription} from '../../../../src/lib/provider-cover-video.js';

export function CoverVideoPlayer({videoId,title,loading,onResult}:{
  videoId:string;title:string;loading:boolean;onResult:(result:'ready'|'failed')=>void;
}){
  const appId=(Platform.OS==='ios'
    ? Constants.expoConfig?.ios?.bundleIdentifier
    : Constants.expoConfig?.android?.package)??'com.loadgistic.app';
  const baseUrl=`https://${appId}/`;
  const uri=coverEmbedUrl(videoId,new URL(baseUrl).origin);
  if(!uri)return null;
  // The local document identifies the app to YouTube and isolates the third-party frame.
  const html=`<!doctype html><html lang="en"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src ${coverPlayerOrigin}; script-src 'nonce-Y292ZXJwbGF5ZXI='">
    <style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#162431}iframe{display:block}</style>
    </head><body><iframe src="${uri.replaceAll('&','&amp;')}" title="YouTube" allow="${coverPlayerPermissions}"
      sandbox="allow-scripts allow-same-origin" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    <script nonce="Y292ZXJwbGF5ZXI=">
      const frame=document.querySelector('iframe');
      const origin=${JSON.stringify(coverPlayerOrigin)};
      const subscription=${JSON.stringify(coverPlayerSubscription)};
      const timer=setInterval(()=>subscription.forEach(command=>frame.contentWindow.postMessage(command,origin)),400);
      let lastState=null;
      window.addEventListener('message',message=>{
        if(message.origin!==origin||message.source!==frame.contentWindow||typeof message.data!=='string'||message.data.length>65536)return;
        let payload;
        try{payload=JSON.parse(message.data);}catch{return;}
        const event=payload?.event;
        if(event==='onReady')clearInterval(timer);
        if(event==='onError'||event==='onAutoplayBlocked'){
          window.ReactNativeWebView?.postMessage(JSON.stringify({event}));
        }
        const state=event==='onStateChange'?payload.info
          :event==='initialDelivery'||event==='infoDelivery'?payload.info?.playerState:null;
        if(typeof state==='number'&&state!==lastState){
          lastState=state;
          window.ReactNativeWebView?.postMessage(JSON.stringify({event:'onStateChange',info:state}));
        }
      });
    </script></body></html>`;
  // Handle navigation here so WebView's origin handler cannot open unrelated URLs externally.
  return <WebView
    accessibilityLabel={title}
    accessibilityElementsHidden={loading}
    importantForAccessibility={loading?'no-hide-descendants':'auto'}
    source={{html,baseUrl}}
    originWhitelist={['*']}
    onShouldStartLoadWithRequest={({url,isTopFrame})=>url==='about:blank'||url===baseUrl||(!isTopFrame&&url===uri)}
    onMessage={({nativeEvent:{data}})=>{const result=coverPlayerResult(data);if(result)onResult(result);}}
    onError={()=>onResult('failed')}
    allowFileAccess={false}
    mixedContentMode="never"
    sharedCookiesEnabled={false}
    thirdPartyCookiesEnabled={false}
    setSupportMultipleWindows={false}
    geolocationEnabled={false}
    mediaCapturePermissionGrantType="deny"
    allowsInlineMediaPlayback
    allowsFullscreenVideo
    mediaPlaybackRequiresUserAction={false}
  />;
}
