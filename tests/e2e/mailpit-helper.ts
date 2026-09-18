export async function localMailpitNumericCode(email:string,requestedAt:number,subject:string|string[]){
  const subjects=Array.isArray(subject)?subject:[subject];
  for(let attempt=0;attempt<40;attempt+=1){
    const response=await fetch('http://127.0.0.1:55324/api/v1/messages');
    if(response.ok){
      const result=await response.json();
      const message=(result.messages||[]).find((candidate:any)=>
        new Date(candidate.Created).getTime()>=requestedAt-2000
        &&subjects.includes(String(candidate.Subject||''))
        &&(candidate.To||[]).some((recipient:any)=>String(recipient.Address||'').toLowerCase()===email.toLowerCase())
      );
      if(message){
        const detailResponse=await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`);
        if(detailResponse.ok){
          const detail=await detailResponse.json();
          const match=String(detail.Text||detail.HTML||'').match(/(?:^|\D)(\d{6})(?:\D|$)/);
          if(match)return match[1];
        }
      }
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Expected a recent application-email code in the isolated local inbox.');
}

// Consume only the exact synthetic recipient's recent Auth email-change link.
// Never log message bodies, addresses or token-bearing links.
export async function localMailpitEmailChangeLink(email:string,requestedAt:number){
 for(let attempt=0;attempt<40;attempt+=1){
  const response=await fetch('http://127.0.0.1:55324/api/v1/messages');
  if(response.ok){
   const result=await response.json();
   const candidates=(result.messages||[]).filter((item:any)=>new Date(item.Created).getTime()>=requestedAt-2000&&(item.To||[]).some((recipient:any)=>String(recipient.Address||'').toLowerCase()===email.toLowerCase()));
   for(const candidate of candidates){
    const detailResponse=await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(candidate.ID)}`);
    if(!detailResponse.ok)continue;const detail=await detailResponse.json();
    for(const match of String(detail.HTML||detail.Text||'').matchAll(/https?:\/\/[^\s<>"']+/g)){
     try{
      const url=new URL(match[0].replaceAll('&amp;','&'));
      if(['127.0.0.1','localhost'].includes(url.hostname)&&url.port==='55321'&&url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='email_change')return url.href;
     }catch{}
    }
   }
  }
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Expected the synthetic recipient’s recent local email-change confirmation.');
}
