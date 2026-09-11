function text(value){return String(value??'').trim();}
function escapeHtml(value){return text(value).replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[character]);}
function line(label,value){return value?`${label}: ${value}`:null;}
function htmlLine(label,value){return value?`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`:'';}
function emailHtml(title,paragraphs){
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0b1d3a;line-height:1.5"><div style="max-width:620px;margin:auto;padding:24px"><h1 style="font-size:24px">${escapeHtml(title)}</h1>${paragraphs.join('')}<p style="color:#5f7077;font-size:13px">Loadgistic connects customers and transporters. Confirm current documents, cargo fit, timing, and commercial terms directly.</p></div></body></html>`;
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
    ?'Use the link and Tracking code below with this approved email. Ask the transporter to add each other person who should follow the shipment.'
    :'Use the separate review code below if you want to review the transporter.';
  const timeline=!started&&Array.isArray(shipment.events)
    ?shipment.events.map(event=>`${statusLabel(event.status)} · ${text(event.created_at)}${event.note?` · ${text(event.note)}`:''}`)
    :[];
  const lines=[intro,line('Tracking reference',shipment.code),line('From',shipment.origin),line('To',shipment.destination),line('Cargo',shipment.cargoSummary)];
  if(timeline.length)lines.push('Status timeline:',...timeline.map(item=>`- ${item}`));
  lines.push('',accessGuidance,started?'Open Tracking':'Open Tracking and review the transporter',text(access?.url),started?'Tracking code':'Review code',text(access?.code));
  const html=[`<p>${escapeHtml(intro)}</p>`,htmlLine('Tracking reference',shipment.code),htmlLine('From',shipment.origin),htmlLine('To',shipment.destination),htmlLine('Cargo',shipment.cargoSummary)];
  if(timeline.length)html.push(`<h2 style="font-size:18px">Status timeline</h2><ul>${timeline.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  html.push(`<p>${escapeHtml(accessGuidance)}</p>`,`<p><a href="${escapeHtml(access?.url)}">${started?'Open Tracking':'Open Tracking and review the transporter'}</a></p>`,htmlLine(started?'Tracking code':'Review code',access?.code));
  return {...payload,subject:title,text:lines.filter(value=>value!==null).join('\n'),html:emailHtml(title,html)};
}

function accessMessage(payload){
  const shared=payload.template==='shared-capacity-access';
  const tracking=payload.template==='tracking-access-code';
  const title=shared?'Your Private capacity code':tracking?'Your shipment Tracking code':'Your Assisted matching recovery code';
  const intro=shared
    ?'Use this six-digit code within 10 minutes to open truck capacity privately shared with this email. This does not create a Loadgistic account.'
    :tracking
      ?'Use this six-digit code within 10 minutes to open the shipment updates shared with this email. This does not create a Loadgistic account.'
    :'Use this code to return to your private Assisted matching conversation.';
  const label=shared||tracking?'Six-digit code':'Recovery code';
  return {
    ...payload,subject:title,
    text:[intro,'',payload.access?.url,label,payload.access?.code].map(text).join('\n'),
    html:emailHtml(title,[`<p>${escapeHtml(intro)}</p>`,`<p><a href="${escapeHtml(payload.access?.url)}">Open Loadgistic</a></p>`,htmlLine(label,payload.access?.code)])
  };
}

export function buildEmailMessage(payload){
  if(['tracking-started','tracking-completed'].includes(payload?.template))return trackingMessage(payload);
  if(['shared-capacity-access','tracking-access-code','assisted-matching-access'].includes(payload?.template))return accessMessage(payload);
  throw new Error('UNKNOWN_EMAIL_TEMPLATE');
}
