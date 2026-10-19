import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as seo from '../src/lib/seo.js';

const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
function view(path,extra={}){
 const states=[],refs=[],effects=[];let si=0,ri=0;
 const react={useState(value){const n=si++;if(!(n in states))states[n]=value;return[states[n],value=>{states[n]=typeof value==='function'?value(states[n]):value;}];},useRef(value){const n=ri++;return refs[n]||(refs[n]={current:value});}};
 react.useEffect=callback=>effects.push(callback);
 const element=(type,props,key)=>typeof type==='function'?type(props||{}):({type,props:props||{},...(key===undefined?{}:{key})}),ports={react:{__esModule:true,default:react,...react},'react/jsx-runtime':{jsx:element,jsxs:element},'next/navigation':{useRouter:()=>({refresh(){}})},'lucide-react':new Proxy({},{get:(_target,key)=>key}),'@/lib/seo.js':seo,'./public-handle-input':{PublicHandleInput:props=>view('src/components/public-handle-input.tsx').render('PublicHandleInput',props)},'@/components/localization':{Localized:'Localized',Text:'Text'},'./public-identity-image.module.css':{default:{image:'identity-image',company:'company',person:'person',small:'small',normal:'normal',large:'large'}},...extra};
 ports['./localization']={useTranslation:()=>({t:message=>message})};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in ports,'Unexpected import '+key);return ports[key];},exports);
 return{render(name,props){si=ri=0;return exports[name](props);},hydrate(){while(effects.length)effects.shift()();}};
}
const actor={name:'Retained private family name',firstName:'Mary Jane',lastName:'',phone:'+251911000001',publicCallbackPhone:'+251911000002',canEditPublicContact:true};
test('provider identity labels and search help have native copy in every supported non-English language',()=>{
 const keys=['Account name','Account manager','Handle','Use your name or a name for your transport work.','Only your first name is shown as Account manager.','Account name, manager or @handle','Search by account name, manager, @handle or city.','No transporters match this search. Try an account name, manager name, handle or city.'];
 for(const locale of ['am','om']){const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));for(const key of keys){assert.equal(typeof messages[key],'string',`${locale}:${key}`);assert.ok(messages[key].trim()&&messages[key]!==key,`${locale}:${key}`);}}
});
test('web account separates explicit public first name, private surname and private/public phones',()=>{
 const tree=view('src/components/account-details-form.tsx').render('AccountDetailsForm',actor),inputs=nodes(tree).filter(node=>node.type==='input'),byName=new Map(inputs.map(node=>[node.props.name,node.props]));
 for(const name of ['firstName','lastName','phone','publicCallbackPhone'])assert.ok(byName.has(name),name+' editor missing');
 assert.equal(byName.get('firstName').defaultValue,'Mary Jane');assert.equal(byName.get('lastName').defaultValue,'','Historical family name must not be guessed');
 assert.equal(byName.get('phone').defaultValue,actor.phone);assert.equal(byName.get('publicCallbackPhone').defaultValue,actor.publicCallbackPhone);
 assert.equal(byName.has('name'),false,'Retained private full name must not be resubmitted as new structured authority');
});
test('web account sends compound first name and an explicit callback clear through its actual submit handler',async()=>{
 const tree=view('src/components/account-details-form.tsx').render('AccountDetailsForm',actor),form=nodes(tree).find(node=>node.props.onSubmit),previousFetch=globalThis.fetch,previousFormData=globalThis.FormData,previousInput=globalThis.HTMLInputElement,calls=[];
 globalThis.HTMLInputElement=class{value='0';};const marker=new globalThis.HTMLInputElement(),element={elements:{namedItem:()=>marker}};
 globalThis.FormData=class{constructor(){this.fields=new Map([['firstName','Mary Jane'],['lastName','Bekele'],['phone',actor.phone],['publicCallbackPhone','']]);}get(key){return this.fields.get(key)??null;}has(key){return this.fields.has(key);}};
 globalThis.fetch=async(path,options)=>{calls.push([path,JSON.parse(options.body)]);return{ok:true,json:async()=>({ok:true})};};
 try{nodes(tree).find(node=>node.type==='input'&&node.props.name==='publicCallbackPhone').props.onChange({currentTarget:{form:element}});assert.equal(marker.value,'1');await form.props.onSubmit({preventDefault(){},currentTarget:element});assert.deepEqual(calls,[['/api/account/details',{firstName:'Mary Jane',lastName:'Bekele',phone:actor.phone,publicCallbackPhone:''}]]);assert.equal(marker.value,'0');}finally{globalThis.fetch=previousFetch;globalThis.FormData=previousFormData;if(previousInput===undefined)delete globalThis.HTMLInputElement;else globalThis.HTMLInputElement=previousInput;}
});
test('untouched historical blank callback is omitted, while an explicit repeated blank remains authoritative',async()=>{
 const previousFetch=globalThis.fetch,previousFormData=globalThis.FormData,previousInput=globalThis.HTMLInputElement,calls=[];
 globalThis.HTMLInputElement=class{value='0';};const marker=new globalThis.HTMLInputElement(),element={elements:{namedItem:()=>marker}};
 globalThis.FormData=class{get(key){return{firstName:'Mary Jane',lastName:'',phone:actor.phone,publicCallbackPhone:''}[key]??null;}};
 globalThis.fetch=async(_path,options)=>{calls.push(JSON.parse(options.body));return{ok:true,json:async()=>({ok:true})};};
 try{
  const runtime=view('src/components/account-details-form.tsx'),tree=runtime.render('AccountDetailsForm',{...actor,publicCallbackPhone:''}),form=nodes(tree).find(node=>node.props.onSubmit);
  await form.props.onSubmit({preventDefault(){},currentTarget:element});assert.equal('publicCallbackPhone'in calls[0],false);
  nodes(tree).find(node=>node.type==='input'&&node.props.name==='publicCallbackPhone').props.onChange({currentTarget:{form:element}});
  await form.props.onSubmit({preventDefault(){},currentTarget:element});assert.equal(calls[1].publicCallbackPhone,'');
 }finally{globalThis.fetch=previousFetch;globalThis.FormData=previousFormData;if(previousInput===undefined)delete globalThis.HTMLInputElement;else globalThis.HTMLInputElement=previousInput;}
});
test('a company account keeps its separate business callback out of personal account submission',async()=>{
 const tree=view('src/components/account-details-form.tsx').render('AccountDetailsForm',{...actor,canEditPublicContact:false});
 assert.equal(nodes(tree).some(node=>node.type==='input'&&node.props.name==='publicCallbackPhone'),false);
});
test('web identity image keeps company/person blanks distinct and failed photos fall back without stock portraits',()=>{
 const runtime=view('src/components/public-identity-image.tsx');
 const company=runtime.render('PublicIdentityImage',{kind:'company',label:'Transport company'}),person=runtime.render('PublicIdentityImage',{kind:'person',label:'Driver'});
 assert.ok(nodes(company).some(node=>node.type==='Building2'));assert.ok(nodes(person).some(node=>node.type==='UserRound'));
 const unnamed=runtime.render('PublicIdentityImage',{kind:'person',label:''});assert.equal(unnamed.props.role,undefined);assert.equal(unnamed.props['aria-hidden'],true);
 let tree=runtime.render('PublicIdentityImage',{kind:'person',label:'Driver',path:'/api/public/driver-portraits/00000000-0000-4000-8000-000000000001'}),photo=nodes(tree).find(node=>node.type==='img');assert.ok(photo);photo.props.onError();
 tree=runtime.render('PublicIdentityImage',{kind:'person',label:'Driver',path:photo.props.src});assert.equal(nodes(tree).some(node=>node.type==='img'),false);assert.ok(nodes(tree).some(node=>node.type==='UserRound'));
});
test('public personal profiles omit legacy extra contacts and About while company business information stays visible',async()=>{
 const provider={provider_kind:'SELF_MANAGED_DRIVER',provider_kind_label:'Independent driver',name:'Public first name',handle:'existing-handle',headline:'PRIVATE-HEADLINE',about:'PRIVATE-ABOUT',contact_phone:'+251911000002',contact_whatsapp:'+251911000003',contact_email:'personal@example.test',contact_website:'https://personal.example.test',youtube_video_id:'private-video',city:'City',fleet_page:{total:0,page:1,pageSize:12,pageCount:1},reviews:[],review_count:0,verification_badges:[]};
 const ports={'next/navigation':{notFound(){throw Error('NOT_FOUND');}},'next/link':{__esModule:true,default:'Link'},'@/components/public-header':{PublicHeader:'PublicHeader'},'@/components/truck-authority':{ProviderTruckSummary:'ProviderTruckSummary'},'@/components/pagination':{Pagination:'Pagination'},'@/components/provider-intro-video':{ProviderIntroVideo:'ProviderIntroVideo'},'@/components/provider-fleet-showcase':{ProviderFleetShowcase:'ProviderFleetShowcase'},'@/components/verification-badges':{VerificationBadges:'VerificationBadges'},'@/components/content-safety':{ContentSafety:'ContentSafety'},'@/components/public-identity-image':{PublicIdentityImage:'PublicIdentityImage'},'@/lib/public-provider.js':{getPublicProvider:async()=>provider}};
 const runtime=view('src/app/providers/[handle]/page.tsx',ports),props={params:Promise.resolve({handle:provider.handle}),searchParams:Promise.resolve({})};
 let tree=await runtime.render('default',props),serialized=JSON.stringify(tree);
 for(const value of [provider.headline,provider.about,provider.contact_whatsapp,provider.contact_email,provider.contact_website,provider.youtube_video_id])assert.ok(!serialized.includes(value),'Personal extra field rendered: '+value);
 assert.ok(serialized.includes(provider.contact_phone));assert.ok(serialized.includes(provider.name));
 provider.account_name='Chosen public account';provider.manager_name='Mary';provider.full_name='PRIVATE-FATHER-NAME';
 tree=await runtime.render('default',props);serialized=JSON.stringify(tree);
 assert.equal(nodes(tree).find(node=>node.type==='h1').props.children,'Chosen public account');assert.ok(serialized.includes('Mary'));assert.ok(serialized.includes('Account manager'));assert.ok(!serialized.includes(provider.full_name));
 provider.provider_kind='FLEET_TRANSPORTER';tree=await runtime.render('default',props);serialized=JSON.stringify(tree);
 assert.equal(nodes(tree).find(node=>node.type==='PublicIdentityImage').props.label,`${provider.name} transporter profile`);
 for(const value of [provider.headline,provider.about,provider.contact_whatsapp.replace(/\D/g,''),provider.contact_email,provider.contact_website,provider.youtube_video_id])assert.ok(serialized.includes(value),'Company field removed: '+value);
});
test('web signup separates chosen public identity from private manager details and driving choice',()=>{
 const runtime=view('src/components/provider-signup-details-form.tsx');let tree=runtime.render('ProviderSignupDetailsForm',{});
 const fields=()=>new Map(nodes(tree).filter(node=>node.type==='input').map(node=>[node.props.name,node.props]));
 assert.equal(fields().get('applicationType').value,'TRANSPORT_PROVIDER');assert.equal(fields().get('accountName').required,true);assert.equal(fields().get('accountName').autoComplete,'nickname');assert.equal(fields().get('handle').required,true);assert.equal(fields().get('handle').autoComplete,'username');assert.equal(fields().has('businessName'),false);assert.equal(fields().has('managerName'),false);
 assert.equal(fields().get('drivesTruck').type,'checkbox');assert.equal(fields().get('drivesTruck').disabled,true);
 assert.equal(fields().get('handle').pattern,'[a-z0-9][a-z0-9_-]{1,63}');assert.equal(fields().get('lastName').required,undefined);
 assert.equal(nodes(tree).some(node=>node.type==='input'&&node.props.type==='radio'),false,'Company and personal accounts are not competing provider categories');
 runtime.hydrate();tree=runtime.render('ProviderSignupDetailsForm',{});assert.equal(fields().get('drivesTruck').disabled,false);
 for(const key of ['firstName','lastName','phone'])assert.ok(fields().has(key));const form=nodes(tree).find(node=>node.type==='form');assert.equal(form.props.action,'/api/applications');assert.equal(form.props.method,'post');
});
test('public account identity and private manager fields remain editable before hydration',()=>{
 const runtime=view('src/components/provider-signup-details-form.tsx');let tree=runtime.render('ProviderSignupDetailsForm',{});
 for(const name of ['accountName','handle','firstName','lastName','phone']){const field=nodes(tree).find(node=>node.type==='input'&&node.props.name===name);assert.equal(field.props.value,undefined);assert.equal(field.props.disabled,undefined);}
 runtime.hydrate();tree=runtime.render('ProviderSignupDetailsForm',{});assert.ok(nodes(tree).some(node=>node.type==='input'&&node.props.name==='accountName'));
});
test('own custom-image previews vary by subject and version while personal profile fields stay bounded',async()=>{
 let page={id:'00000000-0000-4000-8000-000000000001',profile_image_is_custom:true,profile_image_url:'/api/public/providers/first/image?v=old',profile_image_updated_at:'2026-10-13T15:00:00Z',name:'First',published:false};
 const ports={'next/link':{__esModule:true,default:'Link'},'next/navigation':{redirect(){throw Error('REDIRECT');}},'@/lib/auth':{},'@/lib/verification.js':{getVerificationCenter:async()=>({subjects:[]})},'@/components/subject-documents':{SubjectDocuments:'SubjectDocuments'},'@/lib/provider-profile.js':{getOwnCompanyPage:async()=>page},'@/components/page-header':{PageHeader:'PageHeader'},'@/components/flash':{Flash:'Flash'},'@/components/ethiopia-place-input':{EthiopiaPlaceInput:'EthiopiaPlaceInput'},'@/lib/provider-regions.js':{PROVIDER_REGIONS:[]},'@/lib/upload-policy.js':{privateUploadMaxMebibytes:()=>8},'./public-identity-image':{PublicIdentityImage:'PublicIdentityImage'},'./workspace-task-dialog':{WorkspaceTaskDialog:'WorkspaceTaskDialog'},'./account-workspace.module.css':{default:{}}};
 const runtime=view('src/components/provider-profile-workspace.tsx',ports),user={provider_handle:'existing-person',driver_kind:'INDEPENDENT'};
 let tree=await runtime.render('ProviderProfileWorkspace',{user,embedded:true}),image=nodes(tree).find(node=>node.type==='PublicIdentityImage');
 const first=image;assert.equal(image.props.path,`/api/company-page/image?v=${encodeURIComponent(page.profile_image_updated_at)}&preview=${page.id}`);assert.equal(image.key,`${page.id}:${page.profile_image_updated_at}`);
 const names=nodes(tree).filter(node=>['input','textarea','select'].includes(node.type)).map(node=>node.props.name);
 for(const name of ['headline','about','contactPhone','contactWhatsapp','contactEmail','contactWebsite'])assert.equal(names.includes(name),false);
 assert.ok(names.includes('published'));assert.ok(names.includes('baseRegionCode'));assert.ok(nodes(tree).some(node=>node.type==='EthiopiaPlaceInput'&&node.props.placeRefName==='basePlaceRef'));
 page={...page,id:'00000000-0000-4000-8000-000000000002'};tree=await runtime.render('ProviderProfileWorkspace',{user,embedded:true});image=nodes(tree).find(node=>node.type==='PublicIdentityImage');assert.notEqual(image.props.path,first.props.path);assert.notEqual(image.key,first.key);
 const second=image;page={...page,profile_image_updated_at:'2026-10-13T15:01:00Z'};tree=await runtime.render('ProviderProfileWorkspace',{user,embedded:true});image=nodes(tree).find(node=>node.type==='PublicIdentityImage');assert.notEqual(image.props.path,second.props.path);assert.notEqual(image.key,second.key);
 page={...page,profile_image_is_custom:false,profile_image_url:'/images/transporters/approved-preset.png'};tree=await runtime.render('ProviderProfileWorkspace',{user:{organization_id:'company',organization_handle:'existing-company'},embedded:true});image=nodes(tree).find(node=>node.type==='PublicIdentityImage');assert.equal(image.props.path,page.profile_image_url);assert.equal(image.props.kind,'company');
 for(const name of ['contactPhone','contactWhatsapp','contactEmail','contactWebsite'])assert.ok(nodes(tree).some(node=>['input','Localized'].includes(node.type)&&node.props.name===name));
 for(const name of ['headline','about'])assert.ok(nodes(tree).some(node=>node.type==='Localized'&&node.props.name===name));
});
test('signup waits for handlers before role selection or submission while name drafts stay editable',()=>{
 const runtime=view('src/components/provider-signup-details-form.tsx');let tree=runtime.render('ProviderSignupDetailsForm',{selectedType:'TRANSPORT_COMPANY'});
 for(const node of nodes(tree).filter(node=>node.type==='input'&&node.props.type==='radio'||node.type==='button'&&node.props.type==='submit'))assert.equal(node.props.disabled,true);
 assert.equal(nodes(tree).find(node=>node.type==='input'&&node.props.name==='firstName').props.disabled,undefined);
 runtime.hydrate();tree=runtime.render('ProviderSignupDetailsForm',{selectedType:'TRANSPORT_COMPANY'});
 for(const node of nodes(tree).filter(node=>node.type==='input'&&node.props.type==='radio'||node.type==='button'&&node.props.type==='submit'))assert.equal(node.props.disabled,false);
});

test('web handles normalize a pasted @name and case without changing canonical validation',()=>{
 const tree=view('src/components/public-handle-input.tsx').render('PublicHandleInput',{name:'handle',required:true}),input={value:'@Blue-ROAD'};tree.props.onInput({currentTarget:input});assert.equal(input.value,'blue-road');assert.equal(tree.props.minLength,2);assert.equal(tree.props.maxLength,64);assert.equal(tree.props.pattern,'[a-z0-9][a-z0-9_-]{1,63}');
});
