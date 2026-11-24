export const LOCALE_COOKIE='loadgistic_language';
/** @type {ReadonlyArray<{code:'en'|'am'|'om'|'so',name:string}>} */
export const LANGUAGES=Object.freeze([
  {code:'en',name:'English'}, {code:'am',name:'አማርኛ'},
  {code:'om',name:'Afaan Oromo'}, {code:'so',name:'Soomaali'}
]);
/** @param {unknown} value */
export function supportedLocale(value){return LANGUAGES.find(language=>language.code===value)?.code??'en';}
/** Only call at an explicit application-owned copy boundary, never on record data. */
export function translateMessage(messages,message,values={}){
  const key=message.trim();
  const value=Object.hasOwn(messages,key)&&typeof messages[key]==='string'&&messages[key].trim()?messages[key]:key;
  const translated=message.slice(0,message.length-message.trimStart().length)+value+message.slice(message.trimEnd().length);
  return translated.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(token,key)=>Object.hasOwn(values,key)?String(values[key]):token);
}
/** Only for app feedback, never names, descriptions or other record content. */
export function translateFeedback(messages,locale,message,fallback){
  const known=locale==='en'||(Object.hasOwn(messages,message.trim())&&typeof messages[message.trim()]==='string'&&messages[message.trim()].trim());
  return translateMessage(messages,known?message:fallback);
}
