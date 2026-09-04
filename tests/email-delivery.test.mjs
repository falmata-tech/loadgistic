import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {emailDeliveryStatus,sendManagedEmail} from '../src/lib/email-provider.js';
import {deliverPendingAccessEmails,deliverTargetedAccessEmail} from '../src/lib/email-delivery.js';
import {buildEmailMessage} from '../src/lib/email-templates.js';
import {runManagedOperations} from '../src/lib/managed-operations.js';
import {
  createManagedOperationsSignature,
  MANAGED_OPERATIONS_SIGNATURE_HEADER,
  MANAGED_OPERATIONS_TIMESTAMP_HEADER,
  verifyManagedOperationsSignature
} from '../src/lib/managed-operations-auth.js';

const root=process.cwd();

test('managed email configuration prefers a verified direct provider and retains an HTTPS fallback',()=>{
  assert.deepEqual(emailDeliveryStatus({}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324'}),{configured:true,provider:'mailpit'});
  assert.deepEqual(emailDeliveryStatus({NODE_ENV:'production',LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'https://mail.example.test'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://user:secret@127.0.0.1:55324'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324/another-path'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({LOADGISTIC_EMAIL_WEBHOOK_URL:'http://example.test/email'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({LOADGISTIC_EMAIL_WEBHOOK_URL:'https://example.test/email'}),{configured:true,provider:'webhook'});
  const smtp={
    LOADGISTIC_SMTP_HOST:'smtp.gmail.com',LOADGISTIC_SMTP_PORT:'465',
    LOADGISTIC_SMTP_USER:'sender@example.test',LOADGISTIC_SMTP_PASSWORD:'private-app-password',
    LOADGISTIC_EMAIL_FROM:'Loadgistic <sender@example.test>'
  };
  for(const field of Object.keys(smtp)){
    const partial={...smtp};
    delete partial[field];
    assert.deepEqual(emailDeliveryStatus(partial),{configured:false,provider:'none'});
  }
  assert.deepEqual(emailDeliveryStatus({...smtp,LOADGISTIC_SMTP_PORT:'25'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus({...smtp,LOADGISTIC_SMTP_HOST:'smtp.gmail.com\r\nX-Injected: yes'}),{configured:false,provider:'none'});
  assert.deepEqual(emailDeliveryStatus(smtp),{configured:true,provider:'smtp'});
  assert.deepEqual(emailDeliveryStatus({...smtp,LOADGISTIC_EMAIL_WEBHOOK_URL:'https://example.test/email'}),{configured:true,provider:'smtp'});
  assert.deepEqual(emailDeliveryStatus({
    RESEND_API_KEY:'re_test',LOADGISTIC_EMAIL_FROM:'Loadgistic <updates@loadgistic.example>',
    ...smtp,LOADGISTIC_EMAIL_WEBHOOK_URL:'https://example.test/email'
  }),{configured:true,provider:'resend'});
  assert.deepEqual(emailDeliveryStatus({
    NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://localhost:55324',
    RESEND_API_KEY:'re_test',LOADGISTIC_EMAIL_FROM:'Loadgistic <updates@loadgistic.example>'
  }),{configured:true,provider:'mailpit'});
});

test('local application email is captured by loopback Mailpit without leaking its raw idempotency key',async()=>{
  let request;
  const message=buildEmailMessage({
    template:'shared-capacity-access',to:'guest@example.test',
    access:{url:'http://127.0.0.1:3100/shared-capacity',code:'123456'}
  });
  const result=await sendManagedEmail(message,'loadgistic/access/local-stable-key',{
    environment:{NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324'},
    fetchImpl:async(url,options)=>{
      request={url,options};
      return {ok:true,status:200};
    }
  });
  assert.deepEqual(result,{provider:'mailpit'});
  assert.equal(String(request.url),'http://127.0.0.1:55324/api/v1/send');
  assert.equal(request.options.method,'POST');
  assert.equal(request.options.headers['content-type'],'application/json');
  const body=JSON.parse(request.options.body);
  assert.deepEqual(body.From,{Email:'local@loadgistic.local',Name:'Loadgistic local'});
  assert.deepEqual(body.To,[{Email:'guest@example.test'}]);
  assert.equal(body.Subject,'Your Private capacity code');
  assert.match(body.Text,/123456/);
  assert.match(body.HTML,/123456/);
  assert.match(body.Headers['X-Loadgistic-Idempotency-Key'],/^[a-f0-9]{64}$/);
  assert.doesNotMatch(request.options.body,/loadgistic\/access\/local-stable-key/);
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('local Mailpit delivery fails with a bounded non-secret adapter error',async()=>{
  const message=buildEmailMessage({
    template:'shared-capacity-access',to:'guest@example.test',
    access:{url:'http://127.0.0.1:3100/shared-capacity',code:'123456'}
  });
  await assert.rejects(
    sendManagedEmail(message,'loadgistic/access/local-failure',{
      environment:{NODE_ENV:'development',LOADGISTIC_LOCAL_MAILPIT_URL:'http://127.0.0.1:55324'},
      fetchImpl:async()=>({ok:false,status:500})
    }),
    error=>error?.message==='EMAIL_PROVIDER_MAILPIT_FAILED'
  );
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

test('SMTP delivery requires TLS, bounded timeouts, and stable non-secret idempotency headers',async()=>{
  const transports=[];
  const messages=[];
  const environment={
    LOADGISTIC_SMTP_HOST:'SMTP.GMAIL.COM',LOADGISTIC_SMTP_PORT:'465',
    LOADGISTIC_SMTP_USER:'sender@example.test',LOADGISTIC_SMTP_PASSWORD:'smtp-private-secret',
    LOADGISTIC_EMAIL_FROM:'Loadgistic <sender@example.test>',LOADGISTIC_EMAIL_REPLY_TO:'support@example.test'
  };
  const message=buildEmailMessage({
    template:'shared-capacity-access',to:'guest@example.test',
    access:{url:'https://loadgistic.example/shared-capacity',code:'123456'}
  });
  const createTransportImpl=options=>{
    transports.push(options);
    return {sendMail:async payload=>{messages.push(payload);}};
  };
  const first=await sendManagedEmail(message,'loadgistic/access/stable-key',{environment,createTransportImpl});
  const second=await sendManagedEmail(message,'loadgistic/access/stable-key',{environment,createTransportImpl});
  assert.deepEqual(first,{provider:'smtp'});
  assert.deepEqual(second,{provider:'smtp'});
  assert.equal(transports.length,2);
  assert.deepEqual(transports[0],{
    host:'smtp.gmail.com',port:465,secure:true,requireTLS:false,pool:false,logger:false,debug:false,
    connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000,dnsTimeout:8000,
    disableFileAccess:true,disableUrlAccess:true,
    auth:{user:'sender@example.test',pass:'smtp-private-secret'},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true}
  });
  assert.equal(messages[0].messageId,messages[1].messageId);
  assert.equal(messages[0].headers['X-Loadgistic-Idempotency-Key'],messages[1].headers['X-Loadgistic-Idempotency-Key']);
  assert.match(messages[0].messageId,/^<loadgistic-[a-f0-9]{64}@example\.test>$/);
  assert.match(messages[0].headers['X-Loadgistic-Idempotency-Key'],/^[a-f0-9]{64}$/);
  assert.equal(messages[0].replyTo,'support@example.test');
  assert.equal(messages[0].to,'guest@example.test');
  assert.match(messages[0].text,/123456/);
  assert.doesNotMatch(JSON.stringify(messages),/smtp-private-secret|loadgistic\/access\/stable-key/);
  assert.doesNotMatch(JSON.stringify(first),/smtp-private-secret/);
});

test('SMTP port 587 requires STARTTLS and provider failures remain non-secret',async()=>{
  const environment={
    LOADGISTIC_SMTP_HOST:'smtp.example.test',LOADGISTIC_SMTP_PORT:'587',
    LOADGISTIC_SMTP_USER:'sender@example.test',LOADGISTIC_SMTP_PASSWORD:'smtp-private-secret',
    LOADGISTIC_EMAIL_FROM:'sender@example.test'
  };
  let options;
  const message=buildEmailMessage({
    template:'assisted-matching-access',to:'guest@example.test',
    access:{url:'https://loadgistic.example/help',code:'recover-code'}
  });
  await assert.rejects(
    sendManagedEmail(message,'loadgistic/access/smtp-key',{
      environment,
      createTransportImpl:transportOptions=>{
        options=transportOptions;
        return {sendMail:async()=>{throw new Error(`Authentication failed for ${transportOptions.auth.pass}`);}};
      }
    }),
    error=>error?.message==='EMAIL_PROVIDER_SMTP_FAILED'
  );
  assert.equal(options.secure,false);
  assert.equal(options.requireTLS,true);
  assert.equal(options.tls.minVersion,'TLSv1.2');
  assert.equal(options.tls.rejectUnauthorized,true);
  assert.doesNotMatch('EMAIL_PROVIDER_SMTP_FAILED',/smtp-private-secret/);
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

test('Shared Capacity and Tracking use distinct customer-safe application templates',()=>{
  const shared=buildEmailMessage({
    template:'shared-capacity-access',to:'guest@example.test',
    access:{url:'https://loadgistic.example/shared-capacity',code:'123456'}
  });
  assert.equal(shared.subject,'Your Private capacity code');
  assert.match(shared.text,/six-digit code/i);
  assert.match(shared.text,/within 10 minutes/i);
  assert.match(shared.text,/does not create a Loadgistic account/i);
  assert.match(shared.text,/123456/);

  const tracking=buildEmailMessage({
    template:'tracking-started',to:'owner@example.test',
    tracking:{url:'https://loadgistic.example/track',code:'LG-0000-1111-2222-3333'},
    shipment:{code:'LGX-TEST',providerName:'Example Transporter',origin:'Addis Ababa',destination:'Adama',cargoSummary:'Workshop inputs'}
  });
  assert.equal(tracking.subject,'Your Loadgistic tracking access');
  assert.match(tracking.text,/Tracking code/);
  assert.match(tracking.text,/LG-0000-1111-2222-3333/);
  assert.match(tracking.text,/Ask the transporter to add each other person/i);
  assert.doesNotMatch(tracking.text,/six-digit|sign-in|create an account/i);
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

test('Shared capacity delivery is rechecked immediately before provider submission',async()=>{
  const sent=[];
  const recorded=[];
  const claimLimits=[];
  const queue=[
    {id:'invalidated-delivery',lease_token:'invalidated-lease',delivery_kind:'SHARED_CAPACITY',entity_id:'invalidated-challenge',recipient_email:'stale@example.test',challenge_expires_at:new Date(Date.now()+120_000).toISOString()},
    {id:'support-delivery',lease_token:'support-lease',delivery_kind:'GUEST_SUPPORT',entity_id:'support-conversation',recipient_email:'support@example.test',challenge_expires_at:null}
  ];
  const result=await deliverPendingAccessEmails(10,{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    listDeliveries:async limit=>{claimLimits.push(limit);const delivery=queue.shift();return delivery?[delivery]:[];},
    recheckDelivery:async id=>id!=='invalidated-delivery',
    sendEmail:async message=>{sent.push(message);return {provider:'smtp'};},
    recordAttempt:async(id,attempt)=>{recorded.push({id,attempt});return true;}
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:1,sent:1,failed:0,skipped:1});
  assert.deepEqual(claimLimits,[1,1,1]);
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,'support@example.test');
  assert.deepEqual(recorded,[{id:'support-delivery',attempt:{leaseToken:'support-lease',sent:true}}]);
  assert.doesNotMatch(JSON.stringify(sent),/stale@example|invalidated-challenge/);
});

test('global access recovery claims one row only after the previous row is terminal',async()=>{
  const events=[];
  const queue=['first','second','unclaimed-third'].map(id=>({
    id,lease_token:`${id}-lease`,delivery_kind:'GUEST_SUPPORT',entity_id:`${id}-conversation`,
    recipient_email:`${id}@example.test`
  }));
  const result=await deliverPendingAccessEmails(2,{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    listDeliveries:async limit=>{
      assert.equal(limit,1);
      const delivery=queue.shift();
      events.push(`claim:${delivery?.id||'empty'}`);
      return delivery?[delivery]:[];
    },
    recheckDelivery:async id=>{events.push(`fence:${id}`);return true;},
    sendEmail:async message=>{events.push(`send:${message.to.split('@')[0]}`);},
    recordAttempt:async(id,attempt)=>{events.push(`record:${id}:${attempt.sent}`);return true;}
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:2,sent:2,failed:0,skipped:0});
  assert.deepEqual(events,[
    'claim:first','fence:first','send:first','record:first:true',
    'claim:second','fence:second','send:second','record:second:true'
  ]);
  assert.equal(queue[0]?.id,'unclaimed-third');
});

test('Shared capacity recheck infrastructure failure leaves its delivery unattempted and does not abort the batch',async()=>{
  const recorded=[];
  const sent=[];
  const queue=[
    {id:'recheck-failure',lease_token:'shared-lease',delivery_kind:'SHARED_CAPACITY',entity_id:'challenge',recipient_email:'guest@example.test',challenge_expires_at:new Date(Date.now()+120_000).toISOString()},
    {id:'support-after-failure',lease_token:'support-lease',delivery_kind:'GUEST_SUPPORT',entity_id:'conversation',recipient_email:'support@example.test'}
  ];
  const result=await deliverPendingAccessEmails(10,{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    listDeliveries:async()=>{const delivery=queue.shift();return delivery?[delivery]:[];},
    recheckDelivery:async id=>{if(id==='recheck-failure')throw new Error('SUPABASE_ACCESS_EMAIL_DELIVERY_CHECK_FAILED');return true;},
    sendEmail:async message=>{sent.push(message);},
    recordAttempt:async(id,attempt)=>{recorded.push({id,attempt});return true;}
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:1,sent:1,failed:0,skipped:1});
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,'support@example.test');
  assert.deepEqual(recorded,[{id:'support-after-failure',attempt:{leaseToken:'support-lease',sent:true}}]);
});

test('targeted access delivery claims and sends only the requested outbox target',async()=>{
  const claims=[];
  const rechecks=[];
  const recorded=[];
  const sent=[];
  const future=new Date(Date.now()+120_000).toISOString();
  const result=await deliverTargetedAccessEmail('SHARED_CAPACITY','new-challenge',{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    claimDelivery:async(kind,entityId)=>{
      claims.push({kind,entityId});
      return {id:'new-delivery',lease_token:'new-lease',delivery_kind:kind,entity_id:entityId,
        recipient_email:'guest@example.test',challenge_expires_at:future};
    },
    recheckDelivery:async(id,leaseToken)=>{rechecks.push({id,leaseToken});return true;},
    sendEmail:async message=>{sent.push(message);},
    recordAttempt:async(id,attempt)=>{recorded.push({id,attempt});return true;}
  });
  assert.deepEqual(claims,[{kind:'SHARED_CAPACITY',entityId:'new-challenge'}]);
  assert.deepEqual(rechecks,[{id:'new-delivery',leaseToken:'new-lease'}]);
  assert.deepEqual(recorded,[{id:'new-delivery',attempt:{leaseToken:'new-lease',sent:true}}]);
  assert.equal(sent.length,1);
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:1,sent:1,failed:0,skipped:0});
});

test('targeted Tracking OTP delivery uses the live challenge lease and Tracking template',async()=>{
  const sent=[];
  const recorded=[];
  const future=new Date(Date.now()+120_000).toISOString();
  const result=await deliverTargetedAccessEmail('TRACKING_OTP','tracking-challenge',{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    claimDelivery:async(kind,entityId)=>({
      id:'tracking-delivery',lease_token:'tracking-lease',delivery_kind:kind,entity_id:entityId,
      recipient_email:'tracking-party@example.test',challenge_expires_at:future
    }),
    recheckDelivery:async(id,leaseToken)=>id==='tracking-delivery'&&leaseToken==='tracking-lease',
    sendEmail:async message=>{sent.push(message);},
    recordAttempt:async(id,attempt)=>{recorded.push({id,attempt});return true;}
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:1,sent:1,failed:0,skipped:0});
  assert.equal(sent.length,1);
  assert.equal(sent[0].template,'tracking-access-code');
  assert.equal(sent[0].to,'tracking-party@example.test');
  assert.match(sent[0].text,/six-digit code/i);
  assert.match(sent[0].text,/\/track/);
  assert.deepEqual(recorded,[{id:'tracking-delivery',attempt:{leaseToken:'tracking-lease',sent:true}}]);
});

test('Guest access delivery uses the same live-lease fence before provider submission',async()=>{
  const sent=[];
  const recorded=[];
  const result=await deliverTargetedAccessEmail('GUEST_SUPPORT','conversation',{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    claimDelivery:async()=>({
      id:'stale-guest-delivery',lease_token:'stale-guest-lease',delivery_kind:'GUEST_SUPPORT',
      entity_id:'conversation',recipient_email:'support@example.test'
    }),
    recheckDelivery:async()=>false,
    sendEmail:async message=>sent.push(message),
    recordAttempt:async(id,attempt)=>{recorded.push({id,attempt});return true;}
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:0,sent:0,failed:0,skipped:1});
  assert.deepEqual(sent,[]);
  assert.deepEqual(recorded,[]);
});

test('Shared capacity delivery keeps a final thirty-second validity margin',async()=>{
  let rechecks=0,sends=0;
  const result=await deliverTargetedAccessEmail('SHARED_CAPACITY','near-expiry-challenge',{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    claimDelivery:async()=>({
      id:'near-expiry-delivery',lease_token:'near-expiry-lease',delivery_kind:'SHARED_CAPACITY',
      entity_id:'near-expiry-challenge',recipient_email:'guest@example.test',
      challenge_expires_at:new Date(Date.now()+20_000).toISOString()
    }),
    recheckDelivery:async()=>{rechecks+=1;return true;},
    sendEmail:async()=>{sends+=1;},
    recordAttempt:async()=>true
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:0,sent:0,failed:0,skipped:1});
  assert.equal(rechecks,0);
  assert.equal(sends,0);
});

test('provider success is never rewritten as failure when its terminal acknowledgement fails',async()=>{
  for(const recordSuccess of [async()=>false,async()=>{throw new Error('database unavailable');}]){
    const attempts=[];
    await assert.rejects(
      deliverTargetedAccessEmail('GUEST_SUPPORT','conversation',{
        deliveryStatus:()=>({configured:true,provider:'smtp'}),
        claimDelivery:async()=>({
          id:'accepted-delivery',lease_token:'accepted-lease',delivery_kind:'GUEST_SUPPORT',
          entity_id:'conversation',recipient_email:'support@example.test'
        }),
        recheckDelivery:async()=>true,
        sendEmail:async()=>({provider:'smtp'}),
        recordAttempt:async(id,attempt)=>{attempts.push({id,attempt});return recordSuccess();}
      }),
      error=>/^ACCESS_EMAIL_SUCCESS_RECORD_(?:REJECTED|FAILED)$/.test(error?.message)
    );
    assert.equal(attempts.length,1);
    assert.deepEqual(attempts[0],{id:'accepted-delivery',attempt:{leaseToken:'accepted-lease',sent:true}});
  }
});

test('provider rejection records exactly one fenced failure',async()=>{
  const attempts=[];
  const result=await deliverTargetedAccessEmail('GUEST_SUPPORT','conversation',{
    deliveryStatus:()=>({configured:true,provider:'smtp'}),
    claimDelivery:async()=>({
      id:'failed-delivery',lease_token:'failed-lease',delivery_kind:'GUEST_SUPPORT',
      entity_id:'conversation',recipient_email:'support@example.test'
    }),
    recheckDelivery:async()=>true,
    sendEmail:async()=>{throw new Error('EMAIL_PROVIDER_SMTP_FAILED');},
    recordAttempt:async(id,attempt)=>{attempts.push({id,attempt});return true;}
  });
  assert.deepEqual(result,{configured:true,provider:'smtp',attempted:1,sent:0,failed:1,skipped:0});
  assert.deepEqual(attempts,[{
    id:'failed-delivery',attempt:{leaseToken:'failed-lease',sent:false,error:'EMAIL_PROVIDER_SMTP_FAILED'}
  }]);
});

test('scheduled operations expose bounded counts and safe errors only',async()=>{
  const limits=[];
  const result=await runManagedOperations({
    emailLimit:7,cleanupLimit:9,
    deliverShipment:async limit=>{limits.push(limit);return {configured:true,provider:'resend',attempted:3,sent:2,failed:1,privateRows:['secret']};},
    deliverAccess:async limit=>{limits.push(limit);throw new Error('recipient guest@example.test failed');},
    purgeGuests:async limit=>{limits.push(limit);return {count:4,shipmentIds:['private-shipment-id']};},
    purgeSharedCapacity:async limit=>{limits.push(limit);return {otpCount:2,deliveryCount:3,recipientEmails:['private@example.test']};},
    purgeRateLimits:async limit=>{limits.push(limit);return 6;}
  });
  assert.deepEqual(limits,[7,7,9,9,9]);
  assert.equal(result.ok,false);
  assert.deepEqual(result.operations[0],{
    name:'tracking-email',ok:true,result:{configured:true,provider:'resend',attempted:3,sent:2,failed:1,skipped:0}
  });
  assert.deepEqual(result.operations[1],{name:'access-email',ok:false,error:'OPERATION_FAILED'});
  assert.deepEqual(result.operations[2],{name:'tracking-guest-cleanup',ok:true,result:{count:4}});
  assert.deepEqual(result.operations[3],{name:'shared-capacity-cleanup',ok:true,result:{otpCount:2,deliveryCount:3}});
  assert.deepEqual(result.operations[4],{name:'rate-limit-cleanup',ok:true,result:{count:6}});
  assert.doesNotMatch(JSON.stringify(result),/guest@example|private-shipment|secret/);
});

test('two-minute access-email recovery dispatches authenticated background work',async()=>{
  const {config,dispatchAccessEmailRetry}=await import('../netlify/functions/access-email-retry.mjs');
  const environment={SESSION_SECRET:'access-email-background-secret-for-tests',NODE_ENV:'production'};
  const now=1_788_200_000_000;
  let captured;
  const result=await dispatchAccessEmailRetry({
    invocationUrl:'https://branch--loadgistic.example/.netlify/functions/access-email-retry',environment,now,
    fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,status:202};}
  });
  assert.deepEqual(result,{ok:true,status:202});
  assert.equal(config.schedule,'*/2 * * * *');
  assert.equal(captured.url.href,'https://branch--loadgistic.example/.netlify/functions/access-email-retry-background');
  assert.equal(verifyManagedOperationsSignature({
    timestamp:captured.options.headers[MANAGED_OPERATIONS_TIMESTAMP_HEADER],
    signature:captured.options.headers[MANAGED_OPERATIONS_SIGNATURE_HEADER],
    audience:captured.url.href
  },environment,now),true);
});

test('access-email recovery background is lease-bounded and reports safe counts only',async()=>{
  const {config,executeAccessEmailRetry}=await import('../netlify/functions/access-email-retry-background.mjs');
  const environment={SESSION_SECRET:'access-email-background-secret-for-tests',NODE_ENV:'production'};
  const now=1_788_200_000_000;
  const timestamp=String(now);
  const url='https://loadgistic.example/.netlify/functions/access-email-retry-background';
  const signature=createManagedOperationsSignature({timestamp,audience:url},environment);
  const limits=[];
  const originalInfo=console.info;
  const logs=[];
  console.info=value=>logs.push(String(value));
  try{
    const response=await executeAccessEmailRetry(new Request(url,{method:'POST',headers:{
      [MANAGED_OPERATIONS_TIMESTAMP_HEADER]:timestamp,[MANAGED_OPERATIONS_SIGNATURE_HEADER]:signature
    }}),{environment,now,
      deliver:async limit=>{
        limits.push(limit);
        return {configured:true,provider:'smtp',attempted:2,sent:1,failed:1,skipped:0,
          recipientEmails:['private@example.test']};
      }
    });
    assert.equal(response.status,204);
  }finally{
    console.info=originalInfo;
  }
  assert.deepEqual(limits,[2]);
  assert.equal(config.background,true);
  assert.match(logs[0],/"attempted":2/);
  assert.doesNotMatch(logs.join('\n'),/private@example\.test|recipientEmails/);
});

test('access-email recovery background rejects unsigned work before touching the queue',async()=>{
  const {executeAccessEmailRetry}=await import('../netlify/functions/access-email-retry-background.mjs');
  let calls=0;
  const response=await executeAccessEmailRetry(new Request(
    'https://loadgistic.example/.netlify/functions/access-email-retry-background',{method:'POST'}
  ),{
    environment:{SESSION_SECRET:'access-email-background-secret-for-tests',NODE_ENV:'production'},
    now:1_788_200_000_000,deliver:async()=>{calls+=1;}
  });
  assert.equal(response.status,401);
  assert.equal(calls,0);
});

test('scheduled worker and migration remain bounded and service-role-only',()=>{
  const worker=fs.readFileSync(path.join(root,'netlify/functions/managed-operations.mjs'),'utf8');
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/046_managed_email_operations.sql'),'utf8');
  assert.doesNotMatch(worker,/DATA_BACKEND|managed-data-backend-required/);
  assert.match(worker,/schedule:'\*\/15 \* \* \* \*'/);
  assert.match(migration,/for update skip locked/i);
  assert.match(migration,/next_attempt_at=now\(\)\+interval '10 minutes'/i);
  assert.match(migration,/revoke all on function public\.pending_provider_tracking_email_deliveries\(integer\) from public,anon,authenticated/i);
  assert.match(migration,/grant execute on function public\.pending_provider_tracking_email_deliveries\(integer\) to service_role/i);
  assert.match(migration,/'status',event\.status,'note',event\.note,'created_at',event\.created_at/i);
  assert.doesNotMatch(migration,/proof_storage_path|actor_user_id|approximate_lat|approximate_lng/i);
});
