function text(value){return String(value??'').trim();}
function escapeHtml(value){return text(value).replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[character]);}
function line(label,value){return value?`${label}: ${value}`:null;}
function htmlLine(label,value){return value?`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`:'';}
function emailHtml(title,paragraphs){
  return `<!doctype html><html><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#0b1d3a;line-height:1.5"><div style="max-width:620px;margin:24px auto;padding:24px;border:1px solid #d7dfeb;border-radius:14px;background:#fff"><img src="https://loadgistic.com/brand/loadgistic-wordmark-on-white.png" alt="Loadgistic" width="174" height="45" style="display:block;max-width:100%;height:auto;margin:0 0 20px"/><h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(title)}</h1>${paragraphs.join('')}</div></body></html>`;
}
function statusLabel(value){
  return text(value).toLowerCase().replaceAll('_',' ').replace(/\b\w/g,character=>character.toUpperCase());
}

function trackingMessage(payload){
  const started=payload.template==='tracking-started';
  const shipment=payload.shipment||{};
  const access=started?payload.tracking:payload.review;
  const title=started?'Your Loadgistic tracking access':'Your Loadgistic delivery record';
  const intro=started
    ?`${text(shipment.providerName)||'Your transporter'} started a private Tracking session for your shipment.`
    :`${text(shipment.providerName)||'Your transporter'} marked your shipment complete.`;
  const accessGuidance=started
    ?'Open the link and verify this email with one six-digit code. From Tracking, you can share route and status updates with others. They will not see the vehicle’s current location.'
    :'Open Tracking with this email to view your delivery record and leave a review. If you are already verified, no new code is needed.';
  const timeline=!started&&Array.isArray(shipment.events)
    ?shipment.events.map(event=>`${statusLabel(event.status)} · ${text(event.created_at)}${event.note?` · ${text(event.note)}`:''}`)
    :[];
  const lines=[intro,line('Tracking reference',shipment.code),line('From',shipment.origin),line('To',shipment.destination),line('Cargo',shipment.cargoSummary)];
  if(timeline.length)lines.push('Status timeline:',...timeline.map(item=>`- ${item}`));
  lines.push('',accessGuidance,started?'Open Tracking':'Open Tracking and review the transporter',text(access?.url));
  const html=[`<p>${escapeHtml(intro)}</p>`,htmlLine('Tracking reference',shipment.code),htmlLine('From',shipment.origin),htmlLine('To',shipment.destination),htmlLine('Cargo',shipment.cargoSummary)];
  if(timeline.length)html.push(`<h2 style="font-size:18px">Status timeline</h2><ul>${timeline.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  html.push(`<p>${escapeHtml(accessGuidance)}</p>`,`<p><a href="${escapeHtml(access?.url)}" style="color:#155eef;font-weight:700">${started?'Open Tracking':'Open Tracking and review the transporter'}</a></p>`);
  return {...payload,subject:title,text:lines.filter(value=>value!==null).join('\n'),html:emailHtml(title,html)};
}

function accessMessage(payload){
  const tracking=payload.template==='tracking-access-code';
  const title=tracking?'Your Loadgistic tracking sign-in code':'Your Loadgistic support recovery code';
  const intro=tracking
      ?'Use this six-digit code within 10 minutes to open the shipment updates shared with this email. This does not create a Loadgistic account.'
    :'Use this code to return to your private support conversation.';
  const label=tracking?'Six-digit code':'Recovery code';
  return {
    ...payload,subject:title,
    text:[intro,'',payload.access?.url,label,payload.access?.code].map(text).join('\n'),
    html:emailHtml(title,[`<p>${escapeHtml(intro)}</p>`,`<p><a href="${escapeHtml(payload.access?.url)}" style="color:#155eef;font-weight:700">Open Loadgistic</a></p>`,htmlLine(label,payload.access?.code)])
  };
}

export function buildEmailMessage(payload){
  if(payload?.template==='fleet-driver-invitation'){
    const title='You’re invited to join a fleet on Loadgistic';
    const intro=`${text(payload.organizationName)} invited you to join as a Fleet driver.`;
    const guidance='Log in using this email, then choose Join fleet. This invitation expires in seven days. Your fleet owner can assign your vehicle after you accept. If you were not expecting this invitation, ignore it.';
    return {...payload,subject:title,text:[intro,guidance,text(payload.url)].join('\n\n'),
      html:emailHtml(title,[`<p>${escapeHtml(intro)}</p>`,`<p>${escapeHtml(guidance)}</p>`,`<p><a href="${escapeHtml(payload.url)}" style="color:#155eef;font-weight:700">View invitation</a></p>`])};
  }
  if(['tracking-started','tracking-completed'].includes(payload?.template))return trackingMessage(payload);
  if(['tracking-access-code','assisted-matching-access'].includes(payload?.template))return accessMessage(payload);
  throw new Error('UNKNOWN_EMAIL_TEMPLATE');
}
