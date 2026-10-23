import {normalizePersonalName} from './personal-identity.js';
/** @param {Record<string,unknown>} input @returns {{accountName?:string,handle?:string}} */
export function normalizePublicAccountIdentity(input,{required=false}={}){
 const present=Object.hasOwn(input,'accountName')||Object.hasOwn(input,'handle');
 if(!present&&!required)return {};
 if(typeof input.accountName!=='string'||typeof input.handle!=='string')throw Error('INVALID_PUBLIC_ACCOUNT_IDENTITY');
 const accountName=normalizePersonalName(input.accountName),handle=input.handle.trim().toLowerCase();
 if(!accountName||accountName.length>140||/[\x00-\x1f\x7f]/.test(accountName))throw Error('INVALID_PUBLIC_ACCOUNT_NAME');
 if(!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(handle)||['admin','api','app','login','logout','support','track','tracking','featured','privacy','terms','loadgistic'].includes(handle))throw Error('INVALID_ACCOUNT_HANDLE');
 return {accountName,handle};
}
