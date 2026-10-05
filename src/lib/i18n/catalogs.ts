export type Locale='en'|'am'|'om'|'so'|'ti';
export type Messages=Record<string,string>;
const loaders={
  am:()=>import('./messages/am.json'),om:()=>import('./messages/om.json'),
  so:()=>import('./messages/so.json'),ti:()=>import('./messages/ti.json')
};
export async function loadMessages(locale:Locale):Promise<Messages>{
  return locale==='en'?{}:(await loaders[locale]()).default;
}
