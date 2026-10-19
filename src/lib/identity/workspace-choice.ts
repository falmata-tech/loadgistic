import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '../supabase/server';
import {getManagedCurrentUser} from './supabase';
import {managedWorkspaceDestination} from '../auth-flow.js';

export async function workspaceChoiceIdentity(){
 const client=await createSupabaseServerClient();
 const {data,error}=await client.auth.getUser();
 if(error||!data.user?.email_confirmed_at)redirect('/login');
 const user=await getManagedCurrentUser(client,data.user);
 if(!user)redirect('/login');
 if(['ADMIN','SUPPORT'].includes(user.platform_role||user.role))redirect(managedWorkspaceDestination(user.platform_role||user.role));
 if(!user.business_workspace_eligible)redirect('/login?error=This+account+is+not+available');
 return user;
}
