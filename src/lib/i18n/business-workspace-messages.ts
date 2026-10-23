import type {Locale,Messages} from './catalogs';
const rows:readonly (readonly [string,string,string])[]=[
 ['Former team member','የቀድሞ የቡድን አባል','Miseensa garee duraanii'],
 ['Loading your workspaces','መሥሪያዎችዎ እየተከፈቱ ነው','Bakkeewwan hojii keessanii banamaa jiru'],
 ['Could not load this workspace. Please try again.','ይህን መሥሪያ መክፈት አልተቻለም። እንደገና ይሞክሩ።','Bakka hojii kana banuun hin dandaʼamne. Irra deebiʼii yaali.'],
 ['Could not save changes.','ለውጡን ማስቀመጥ አልተቻለም።','Jijjiirama olkaaʼuun hin dandaʼamne.'],
 ['Invitation saved, but email delivery failed. Use Resend.','ግብዣው ተቀምጧል፤ ኢሜይሉ ግን አልተላከም። «እንደገና ላክ» ይምረጡ።','Affeerraan olkaaʼameera; imeeliin garuu hin ergamne. «Irra deebiʼii ergi» filadhu.'],
 ['No map or shipment access','የመኪናና የጭነት መረጃ ፈቃድ የለውም','Odeeffannoo konkolaataa fi feʼumsaa ilaaluuf hayyama hin qabu'],
 ['This member will lose access to this business.','ይህ አባል የድርጅቱን መሥሪያ መጠቀም አይችልም።','Miseensi kun bakka hojii dhaabbata kanaa fayyadamuu hin dandaʼu.'],
 ['Confirm transfer','ባለቤትነቱን አስተላልፍ','Abbummaa dabarsi'],
 ['Transfer ownership or archive your business before closing your account.','መለያዎን ከመዝጋትዎ በፊት የድርጅቱን ባለቤትነት ያስተላልፉ ወይም የድርጅቱን መሥሪያ ይዝጉ።','Herrega keessan cufuu dura abbummaa dhaabbatichaa dabarsaa yookaan bakka hojii dhaabbatichaa cufaa.'],
 ['This workspace is temporarily unavailable. Please try again.','መሥሪያው ለጊዜው አይከፈትም። እንደገና ይሞክሩ።','Bakki hojii kun yeroo ammaa hin banamu. Irra deebiʼii yaali.'],
 ['This business changed. Refresh before saving.','የድርጅቱ መረጃ ተለውጧል። ከማስቀመጥዎ በፊት ያድሱ።','Odeeffannoon dhaabbatichaa jijjiirameera. Olkaaʼuu dura haaromsi.'],
 ['You do not have access to this business.','ይህን የድርጅት መሥሪያ ለመጠቀም ፈቃድ የለዎትም።','Bakka hojii dhaabbata kanaa fayyadamuuf hayyama hin qabdu.'],
 ['That business handle is already in use.','ይህ የድርጅት መለያ ስም ተይዟል።','Maqaan adda baastuu dhaabbataa kun qabameera.'],
 ['This invitation is no longer available.','ይህ ግብዣ ከእንግዲህ ወዲህ አይሠራም።','Affeerraan kun amma hin hojjetu.']
];
export const businessWorkspaceMessages:Record<Locale,Messages>={en:{},am:Object.fromEntries(rows.map(r=>[r[0],r[1]])),om:Object.fromEntries(rows.map(r=>[r[0],r[2]]))};
