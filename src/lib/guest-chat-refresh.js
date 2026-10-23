export function guestChatRefreshDelay({visible,enabled,open,status}){
  if(!visible||!enabled||status==='CLOSED')return null;
  if(!status)return open?30000:null;
  return open?2000:10000;
}
