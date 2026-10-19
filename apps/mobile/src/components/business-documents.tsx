import {useRef,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useAccount} from '../session/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useLanguage} from '../localization/provider';
import {Button,Copy,ErrorText,Field,palette} from './ui';
import {Choices} from './choices';
import {DatePicker} from './date-picker';
import {FilePicker,PrivateFile,uploadBody,useFileSelection} from './private-file';
import {BusinessDocumentBadges} from './business-directory';
import {businessDocumentLabel,parseBusinessDocuments} from '../../../../src/lib/business-directory/client-contract.js';
import type {BusinessDocumentsView} from '../../../../src/lib/business-directory/contracts';

export function BusinessDocuments({workspaceId,canManage,summary=false}:{workspaceId:string;canManage:boolean;summary?:boolean}){
 const account=useAccount(),{t}=useLanguage(),query=useAccountQuery<unknown>(`/api/business-workspaces/${workspaceId}/documents`);
 let data:BusinessDocumentsView|null=null,invalid='';try{if(query.data)data=parseBusinessDocuments(query.data,workspaceId,canManage);}catch{invalid=t('Could not load business details. Please try again.');}
 return <View style={{gap:16}}><ErrorText message={query.error||invalid}/>{query.loading&&<ActivityIndicator/>}{data&&<BusinessDocumentBadges documents={data.documents}/>}
  {!summary&&data&&canManage&&<><Copy message="Documents are private and reviewed by Loadgistic administrators."/><Submit key={`${workspaceId}:${data.subjects[0]?.allowedTypes.join(',')}`} data={data} reload={query.reloadConfirmed}/><Text style={{fontSize:17,fontWeight:'700',color:palette.ink}}>{t('Request history')}</Text>{data.requests.length?data.requests.map(request=><View key={request.id} style={{gap:8,paddingVertical:12,borderTopWidth:1,borderColor:palette.border}}><Text style={{fontSize:15,fontWeight:'600',color:palette.ink}}>{request.name}</Text><Copy>{t(businessDocumentLabel(request.type))} · {t(request.stale?'Account details changed':request.status==='PENDING'?'Awaiting review':request.status==='APPROVED'?'Loadgistic reviewed':request.status==='MORE_INFO'?'More information requested':'Not approved')}</Copy>{!!request.note&&<Copy>{request.note}</Copy>}{request.hasFile&&<PrivateFile label={t('Open private document')} load={()=>account.request(`/api/mobile/verification/${request.id}`)}/>}</View>):<Copy message="No submitted documents"/>}</>}
  <Button secondary message="Refresh documents" busy={query.loading} onPress={()=>{void query.reload();}}/>
 </View>;
}
function Submit({data,reload}:{data:BusinessDocumentsView;reload:()=>Promise<boolean>}){
 const account=useAccount(),{t}=useLanguage(),selection=useFileSelection(),[open,setOpen]=useState(false),[type,setType]=useState(''),[name,setName]=useState(''),[expiry,setExpiry]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),lock=useRef(false);
 const allowed=data.subjects[0]?.allowedTypes||[];
 async function submit(){if(lock.current||!saved&&(!selection.file||!type||!name.trim()))return;lock.current=true;setBusy(true);setError('');
  try{
   if(!saved){await account.request(`/api/business-workspaces/${data.workspaceId}/documents`,uploadBody({verificationType:type,documentName:name.trim(),expiresOn:expiry},selection.file!));setSaved(true);selection.setFile(null);}
   if(!await reload())throw Error(t('Your change was saved. Reload to see the latest details.'));
   setSaved(false);setOpen(false);setName('');setType('');setExpiry('');setNotice(t('Document submitted for review.'));
  }catch(problem){setError(problem instanceof Error?problem.message:t('Could not confirm submission. Refresh documents before trying again.'));}finally{lock.current=false;setBusy(false);}
 }
 return <View style={{gap:12}}><ErrorText message={error}/>{!!notice&&<Copy>{notice}</Copy>}{saved?<><Copy message="Your change was saved. Reload to see the latest details."/><Button secondary message="Reload saved change" busy={busy} onPress={()=>{void submit();}}/></>:open?<><Copy message="Document type"/><Choices value={type} options={allowed.map(id=>({id,label:t(businessDocumentLabel(id))}))} onChange={setType} disabled={busy}/><Field message="Document name" value={name} onChangeText={setName} maxLength={150} editable={!busy}/><DatePicker message="Expires on (optional)" value={expiry} onChange={setExpiry} min={new Date().toISOString().slice(0,10)} disabled={busy}/><FilePicker file={selection.file} onChange={selection.setFile} disabled={busy}/><Button message="Send for review" busy={busy} disabled={!type||!name.trim()||!selection.file} onPress={()=>{void submit();}}/><Button secondary message="Cancel" disabled={busy} onPress={()=>{setOpen(false);setType('');setName('');setExpiry('');selection.setFile(null);setError('');}}/></>:allowed.length?<Button message="Submit a document" onPress={()=>{setOpen(true);setNotice('');}}/>:<Copy message="No documents to submit"/>}</View>;
}
