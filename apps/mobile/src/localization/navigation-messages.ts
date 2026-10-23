import type {Locale,Messages} from './controller';
const rows=[
 ['Marketplace','የጭነት መኪና ገበያ','Gabaa geejjibaa'],
 ['My workspace','የሥራ ማስተዳደሪያዬ','Bakka hojii koo'],
 ['Switch view','እይታ ይቀይሩ','Mulʼata jijjiiri'],
 ['Email and account security','ኢሜይልና የመለያ ደህንነት','Imeelii fi nageenya herregaa'],
 ['Your driver photo','የሹፌር ፎቶዎ','Suuraa konkolaachisaa keessanii'],
 ['Personal','የግል መረጃ','Odeeffannoo dhuunfaa'],
 ['Workspace','የሥራ ማስተዳደሪያ','Bakka hojii'],
 ['My vehicle','መኪናዬ','Konkolaataa koo'],
 ['On-duty Vehicles','በሥራ ላይ ያሉ መኪናዎች','Konkolaattota hojii irra jiran'],
 ['Active Tracking','በመከታተል ላይ ያሉ ጭነቶች','Feʼumsa hordofamaa jiru'],
 ['Published Reviews','የደንበኞች ግምገማዎች','Yaada maamiltootaa'],
 ['Completed Tracking','የተጠናቀቁ ክትትሎች','Hordoffii xumurame'],
 ['Recent tracking','የቅርብ ጊዜ የጭነት ክትትል','Hordoffii feʼumsaa dhihoo'],

 ['Open menu','ማውጫ ክፈት','Baafata bani'],
 ['Close menu','ማውጫ ዝጋ','Baafata cufi'],
 ['Menu','ማውጫ','Baafata'],
 ['Your workspace','የሥራ ማስተዳደሪያ','Bakka hojii keessan'],
 ['Finish account setup','የመለያ ዝግጅትን ጨርስ','Qophii herregaa xumuri'],
 ['Sign out','ውጣ','Baʼi'],
 ['Sign-out could not finish. Please try again.','ከመለያዎ መውጣት አልተጠናቀቀም። እንደገና ይሞክሩ።','Herrega keessaa baʼuun hin xumuramne. Irra deebiʼaa yaalaa.'],
 ['Use the demo credentials provided in Play Console. These accounts contain sample records and cannot access real customer data or Loadgistic staff tools.','በPlay Console የተሰጡትን የሙከራ መግቢያ መረጃዎች ይጠቀሙ። እነዚህ መለያዎች ለሙከራ የተዘጋጀ መረጃ ብቻ አላቸው፤ የእውነተኛ ደንበኞችን መረጃ ወይም የLoadgistic ሠራተኞችን መሣሪያዎች ማግኘት አይችሉም።','Odeeffannoo ittiin seentan kan Play Console keessatti kennametti fayyadamaa. Herregoonni kun odeeffannoo yaalii qofa qabu; odeeffannoo maamiltoota dhugaa yookaan meeshaalee hojii hojjettoota Loadgistic hin argan.'],
 ['Your driving workspace','መኪናዎንና ጭነቶችዎን ያስተዳድሩ','Konkolaataa fi feʼumsa keessan bulchaa'],
 ['Your transport workspace','የትራንስፖርት ሥራዎን ያስተዳድሩ','Hojii geejjibaa keessan bulchaa'],
 ['Close vehicle details','የመኪና ዝርዝርን ዝጋ','Odeeffannoo konkolaataa cufi'],
 ['Close transporter results','የአጓጓዦች ውጤቶችን ዝጋ','Buʼaawwan geejjibdootaa cufi'],
 ['Transporters','አጓጓዦች','Geejjibdoota'],
 ['Partial capacity','ቀሪ የጭነት ቦታ አለ','Iddoo feʼumsaa hafe qaba'],
] as const;
export const navigationMessages:Record<Locale,Messages>={en:{},am:{},om:{}};
for(const [key,am,om] of rows){navigationMessages.am[key]=am;navigationMessages.om[key]=om;}
