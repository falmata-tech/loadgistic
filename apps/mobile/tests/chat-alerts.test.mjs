import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setVisibleChat,isChatMessageVisible,blockChatReading,chatReadingBlocked} from '../src/session/chat-visibility.ts';
import {chatAlertCopy} from '../../../src/lib/chat-alert-delivery.js';
test('covering menus/documents suppress visible-chat delivery without creating read authority',()=>{
 const key='SUPPORT:synthetic',menu={},file={};setVisibleChat(key,5);assert.equal(isChatMessageVisible(key,5),true);assert.equal(isChatMessageVisible(key,6),false);
 blockChatReading(menu,true);assert.equal(chatReadingBlocked(),true);assert.equal(isChatMessageVisible(key,5),false);
 blockChatReading(file,true);blockChatReading(menu,false);assert.equal(isChatMessageVisible(key,5),false);
 blockChatReading(file,false);assert.equal(isChatMessageVisible(key,5),true);
 setVisibleChat(key,null);assert.equal(isChatMessageVisible(key,5),false);
});
test('all chat alerts/read labels are translated with intact interpolation, without translating user messages',()=>{
 const copy=['Seen','Sent','Team member joined','Assigned to {agent}','Chat updates','Chat updates · {count} unread','Chat updates · {count} unread or waiting','{count} unread','No chat updates yet.','Alerts while you’re using this page.','Alerts while you’re using this app.','Updates paused. Reconnecting…','Sound on','Turn on chat sound','Dismiss notification','Open chat','Waiting for assignment','Resolved','Chat ended','Assigned','Waiting for an agent','This chat is not available to you.'];
 for(const kind of ['SUPPORT','BROKERAGE'])for(const side of ['CUSTOMER','TEAM'])for(const event of ['MESSAGE','ASSIGNED','JOINED','QUEUED','ENDED','RESOLVED'])copy.push(chatAlertCopy({item:{kind,side},event}));
 for(const locale of ['am','om','so','ti']){const catalog=JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  for(const key of copy){assert.ok(catalog[key]?.trim(),`${locale}: ${key}`);assert.deepEqual((catalog[key].match(/\{\w+\}/g)||[]).sort(),(key.match(/\{\w+\}/g)||[]).sort());}
 }
});
