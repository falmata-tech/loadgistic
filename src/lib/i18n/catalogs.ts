import type {LANGUAGES} from './core.js';
export type Locale=(typeof LANGUAGES)[number]['code'];
export type Messages=Record<string,string>;
import {gpsMessages} from './gps-messages';
import {trackingSharingMessages} from './tracking-sharing-messages';
import {businessWorkspaceMessages} from './business-workspace-messages';
const loaders={
  am:()=>import('./messages/am.json'),om:()=>import('./messages/om.json'),so:()=>import('./messages/so.json')
};
export async function loadMessages(locale:Locale):Promise<Messages>{
  return locale==='en'?{}:{...(await loaders[locale]()).default,...gpsMessages[locale],...trackingSharingMessages[locale],...businessWorkspaceMessages[locale]};
}
