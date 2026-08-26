import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {emailDeliveryStatus,sendManagedEmail} from '../src/lib/email-provider.js';
import {buildEmailMessage} from '../src/lib/email-templates.js';
import {runManagedOperations} from '../src/lib/managed-operations.js';

const root=process.cwd();

test('managed email configuration prefers a verified direct provider and retains an HTTPS fallback',()=>{
  assert.deepEqual(emailDeliveryStatus({}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({LOADGISTIC_EMAIL_WEBHOOK_URL:'http://example.test/email'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({LOADGISTIC_EMAIL_WEBHOOK_URL:'https://example.test/email'}),{configured:true,provider:'webhook'});
  assert.deepEqual(emailDeliveryStatus({
    RESEND_API_KEY:'re_test',LOADGISTIC_EMAIL_FROM:'Loadgistic <updates@loadgistic.example>',
    LOADGISTIC_EMAIL_WEBHOOK_URL:'https://example.test/email'
  }),{configured:true,provider:'resend'});
});

test('direct email delivery uses a stable provider request without exposing the secret in content',async()=>{
  const requests=[];
  const message=buildEmailMessage({
    template:'shared-capacity-access',to:'guest@example.test',
    access:{url:'https://loadgistic.example/shared-capacity',code:'123456'}
  });
  const result=await sendManagedEmail(message,'loadgistic/access/stable-key',{
    environment:{
      RESEND_API_KEY:'re_private_secret',
      LOADGISTIC_EMAIL_FROM:'Loadgistic <updates@loadgistic.example>',
      LOADGISTIC_EMAIL_REPLY_TO:'support@loadgistic.example'
    },
    fetchImpl:async(url,options)=>{
      requests.push({url,options});
      return {ok:true,status:200};
    }
  });
  assert.deepEqual(result,{provider:'resend'});
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,'https://api.resend.com/emails');
  assert.equal(requests[0].options.headers['idempotency-key'],'loadgistic/access/stable-key');
  assert.equal(requests[0].options.headers['user-agent'],'Loadgistic/1.0');
  assert.equal(requests[0].options.headers.authorization,'Bearer re_private_secret');
  const body=JSON.parse(requests[0].options.body);
  assert.deepEqual(body.to,['guest@example.test']);
  assert.equal(body.reply_to,'support@loadgistic.example');
  assert.match(body.text,/123456/);
  assert.doesNotMatch(requests[0].options.body,/re_private_secret/);
});

test('webhook adapter preserves the bounded template payload and idempotency key',async()=>{
  let request;
  const message=buildEmailMessage({
    template:'assisted-matching-access',to:'guest@example.test',
    access:{url:'https://loadgistic.example/help',code:'recover-code'}
  });
  await sendManagedEmail(message,'loadgistic/access/webhook-key',{
    environment:{LOADGISTIC_EMAIL_WEBHOOK_URL:'https://mail.example.test/send',LOADGISTIC_EMAIL_WEBHOOK_TOKEN:'private-token'},
    fetchImpl:async(url,options)=>{
      request={url,options};
      return {ok:true,status:200};
    }
  });
  assert.equal(request.url.href,'https://mail.example.test/send');
  assert.equal(request.options.headers['idempotency-key'],'loadgistic/access/webhook-key');
  const body=JSON.parse(request.options.body);
  assert.equal(body.template,'assisted-matching-access');
  assert.equal(body.access.code,'recover-code');
  assert.doesNotMatch(request.options.body,/private-token/);
});

test('completion email escapes customer-visible data and excludes private event fields',()=>{
  const message=buildEmailMessage({
    template:'tracking-completed',to:'guest@example.test',review:{url:'https://loadgistic.example/track',code:'review-code'},
    shipment:{
      code:'LG-TEST',providerName:'Example <script>alert(1)</script>',origin:'Addis Ababa',destination:'Adama',
      cargoSummary:'Workshop inputs',events:[{
        status:'IN_TRANSIT',note:'Arrived <strong>safely</strong>',created_at:'2026-08-25T08:00:00Z',
        proof_path:'private/proof.jpg',actor_user_id:'private-user',approximate_lat:9.01
      }]
    }
  });
  assert.match(message.text,/Status timeline/);
  assert.match(message.text,/In Transit/);
  assert.doesNotMatch(message.html,/<script>|<strong>safely<\/strong>/);
  assert.match(message.html,/&lt;script&gt;|&lt;strong&gt;/);
  assert.doesNotMatch(`${message.text}${message.html}`,/private\/proof|private-user|approximate_lat/);
});

test('scheduled operations expose bounded counts and safe errors only',async()=>{
  const limits=[];
  const result=await runManagedOperations({
    emailLimit:7,cleanupLimit:9,
    deliverShipment:async limit=>{limits.push(limit);return {configured:true,provider:'resend',attempted:3,sent:2,failed:1,privateRows:['secret']};},
    deliverAccess:async limit=>{limits.push(limit);throw new Error('recipient guest@example.test failed');},
    purgeGuests:async limit=>{limits.push(limit);return {count:4,shipmentIds:['private-shipment-id']};}
  });
  assert.deepEqual(limits,[7,7,9]);
  assert.equal(result.ok,false);
  assert.deepEqual(result.operations[0],{
    name:'tracking-email',ok:true,result:{configured:true,provider:'resend',attempted:3,sent:2,failed:1}
  });
  assert.deepEqual(result.operations[1],{name:'access-email',ok:false,error:'OPERATION_FAILED'});
  assert.deepEqual(result.operations[2],{name:'tracking-guest-cleanup',ok:true,result:{count:4}});
  assert.doesNotMatch(JSON.stringify(result),/guest@example|private-shipment|secret/);
});

test('scheduled worker and migration remain bounded and service-role-only',()=>{
  const worker=fs.readFileSync(path.join(root,'netlify/functions/managed-operations.mjs'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/046_managed_email_operations.sql'),'utf8');
  assert.match(worker,/DATA_BACKEND!=='supabase'/);
  assert.match(worker,/schedule:'\*\/15 \* \* \* \*'/);
  assert.match(migration,/for update skip locked/i);
  assert.match(migration,/next_attempt_at=now\(\)\+interval '10 minutes'/i);
  assert.match(migration,/revoke all on function public\.pending_provider_tracking_email_deliveries\(integer\) from public,anon,authenticated/i);
  assert.match(migration,/grant execute on function public\.pending_provider_tracking_email_deliveries\(integer\) to service_role/i);
  assert.match(migration,/'status',event\.status,'note',event\.note,'created_at',event\.created_at/i);
  assert.doesNotMatch(migration,/proof_storage_path|actor_user_id|approximate_lat|approximate_lng/i);
});
