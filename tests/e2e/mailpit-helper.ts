export async function localMailpitNumericCode(email:string,requestedAt:number,subject:string){
  for(let attempt=0;attempt<40;attempt+=1){
    const response=await fetch('http://127.0.0.1:55324/api/v1/messages');
    if(response.ok){
      const result=await response.json();
      const message=(result.messages||[]).find((candidate:any)=>
        new Date(candidate.Created).getTime()>=requestedAt-2000
        &&String(candidate.Subject||'')===subject
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
