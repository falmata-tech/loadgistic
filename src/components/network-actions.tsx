import { Heart, HeartOff, Link2, Link2Off, UserCheck } from 'lucide-react';

type NetworkState = {
  eligible:boolean;
  status:string|null;
  is_favorite:boolean;
  incoming:boolean;
  outgoing:boolean;
  connect_eligible?:boolean;
};

function NetworkForm({targetKind,targetId,returnTo,action,label,kind='secondary',Icon}:{targetKind:string;targetId:string;returnTo:string;action:string;label:string;kind?:string;Icon:any}) {
  return <form action="/api/network" method="post">
    <input type="hidden" name="targetKind" value={targetKind}/>
    <input type="hidden" name="targetId" value={targetId}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <input type="hidden" name="action" value={action}/>
    <button className={`button ${kind} small icon-button-label`}><Icon aria-hidden="true"/>{label}</button>
  </form>;
}

export function NetworkActions({state,targetKind,targetId,returnTo}:{state:NetworkState;targetKind:string;targetId:string;returnTo:string}) {
  if(!state.eligible)return null;
  if(state.status==='CONNECTED')return <div className="network-action-row"><span className="status green"><UserCheck aria-hidden="true"/>Connected</span></div>;
  if(state.incoming)return <div className="network-action-row">
    <NetworkForm targetKind={targetKind} targetId={targetId} returnTo={returnTo} action="ACCEPT" label="Accept" kind="" Icon={UserCheck}/>
    <NetworkForm targetKind={targetKind} targetId={targetId} returnTo={returnTo} action="DECLINE" label="Decline" Icon={Link2Off}/>
  </div>;
  return <div className="network-action-row">
    <NetworkForm targetKind={targetKind} targetId={targetId} returnTo={returnTo} action={state.is_favorite?'UNFAVORITE':'FAVORITE'} label={state.is_favorite?'Unfavorite':'Favorite'} Icon={state.is_favorite?HeartOff:Heart}/>
    {state.connect_eligible===false?null:state.outgoing?<span className="status"><Link2 aria-hidden="true"/>Request sent</span>:<NetworkForm targetKind={targetKind} targetId={targetId} returnTo={returnTo} action="REQUEST" label="Connect" kind="" Icon={Link2}/>}
  </div>;
}
