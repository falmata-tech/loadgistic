import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {checked,localAuditService,acceptAuditContentPolicy} from './audit-helpers';
import type {Page} from 'playwright-core';
// Isolated local verified sessions only; no email, password fallback or hosted access.
export async function localSupportLogin(page:Page,id:string){
 const service=localAuditService(),identity=checked(await service.auth.admin.getUserById(id)).user;
 await acceptAuditContentPolicy(service,id);
 const link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email}));
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
 const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=checked(await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'}));
 await page.context().clearCookies();
 const cookies=createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.session)).toString('base64url'));
 await page.context().addCookies(cookies.map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
 return ()=>client.auth.signOut({scope:'local'});
}
