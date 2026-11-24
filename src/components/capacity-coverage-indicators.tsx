import {Check} from 'lucide-react';
import {Text} from './localization';

export function CapacityCoverageIndicators({planned,preferred}:{planned:string|null;preferred:string|null}) {
  const labels=[planned,preferred].filter((label):label is string=>label!==null);
  if(!labels.length)return null;
  return <div className="capacity-coverage-indicators">
    {labels.map(label=><span key={label}><Check aria-hidden="true"/><Text message={label}/></span>)}
  </div>;
}
