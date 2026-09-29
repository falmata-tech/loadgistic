export const LOCALE_COOKIE='loadgistic_language';
export const LANGUAGES=Object.freeze([
  {code:'en',name:'English'}, {code:'am',name:'አማርኛ'},
  {code:'om',name:'Afaan Oromo'}, {code:'so',name:'Soomaali'}, {code:'ti',name:'ትግርኛ'}
]);
export function supportedLocale(value){return LANGUAGES.some(language=>language.code===value)?value:'en';}
/** Only call at an explicit application-owned copy boundary, never on record data. */
export function translateMessage(messages,message,values={}){
  const key=message.trim();
  const value=Object.hasOwn(messages,key)&&typeof messages[key]==='string'&&messages[key].trim()?messages[key]:key;
  const translated=message.slice(0,message.length-message.trimStart().length)+value+message.slice(message.trimEnd().length);
  return translated.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(token,key)=>Object.hasOwn(values,key)?String(values[key]):token);
}
