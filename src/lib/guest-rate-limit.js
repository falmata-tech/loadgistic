import {checkRateLimit} from './rate-limit.js';

/**
 * @template Scope
 * @param {{
 *   originKey:string,
 *   originLimit:number,
 *   windowMs:number,
 *   readScope?:()=>Promise<{key:string,value:Scope}>,
 *   scopedLimit?:number,
 *   consume?:(key:string,limit:number,windowMs:number)=>Promise<{allowed:boolean,retryAfterSeconds:number}>
 * }} options
 * @returns {Promise<{allowed:boolean,retryAfterSeconds:number,scope:Scope|null}>}
 */
export async function checkOriginBeforeScopedLimit(options){
  const {
    originKey,originLimit,windowMs,readScope,
    scopedLimit=originLimit,consume=checkRateLimit
  }=options;
  const origin=await consume(originKey,originLimit,windowMs);
  if(!origin.allowed){
    return {allowed:false,retryAfterSeconds:origin.retryAfterSeconds,scope:null};
  }
  if(!readScope){
    return {allowed:true,retryAfterSeconds:0,scope:null};
  }
  const scope=await readScope();
  const scoped=await consume(scope.key,scopedLimit,windowMs);
  return {
    allowed:scoped.allowed,
    retryAfterSeconds:scoped.retryAfterSeconds,
    scope:scope.value
  };
}
