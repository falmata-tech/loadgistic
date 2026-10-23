import {Text} from './localization';
import {demoTrackingLabel} from '../lib/demo-tracking-identity.js';

export function DemoTrackingLabel({kind='shipment'}:{kind?:'shipment'|'event'|'proof'|'approval'}) {
  return <span className="status blue" data-demo-tracking={kind}>
    <Text message={demoTrackingLabel(kind)}/>
  </span>;
}
