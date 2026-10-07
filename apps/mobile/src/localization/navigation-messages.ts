import type {Locale,Messages} from './controller';
const rows=[
 ['Marketplace','የጭነት መኪና ገበያ','Gabaa geejjibaa','Suuqa gaadiidka','ዕዳጋ መጓዓዝያ'],
 ['My workspace','የሥራ ማስተዳደሪያዬ','Bakka hojii koo','Goobtayda shaqada','መመሓደሪ ስርሐይ'],
 ['Switch view','እይታ ይቀይሩ','Mulʼata jijjiiri','Beddel muuqaalka','ኣቀራርባ ቀይሩ'],
 ['Email and account security','ኢሜይልና የመለያ ደህንነት','Imeelii fi nageenya herregaa','Iimaylka iyo amniga akoonka','ኢመይልን ድሕነት ሕሳብን'],
 ['Your driver photo','የሹፌር ፎቶዎ','Suuraa konkolaachisaa keessanii','Sawirkaaga darawalnimo','ስእሊ ሾፌርኩም'],
 ['Personal','የግል መረጃ','Odeeffannoo dhuunfaa','Xogtaada','ውልቃዊ ሓበሬታ'],
 ['Workspace','የሥራ ማስተዳደሪያ','Bakka hojii','Goobta shaqada','መመሓደሪ ስራሕ'],
 ['My truck','መኪናዬ','Konkolaataa koo','Gaarigayga','መኪናይ'],
 ['On-duty Trucks','በሥራ ላይ ያሉ መኪናዎች','Konkolaattota hojii irra jiran','Gaadiidka shaqaynaya','ኣብ ስራሕ ዘለዋ መካይን'],
 ['Active Tracking','በመከታተል ላይ ያሉ ጭነቶች','Feʼumsa hordofamaa jiru','Xamuulka lala socdo','ዝከታተሉ ዘለዉ ጽዕነታት'],
 ['Published Reviews','የደንበኞች ግምገማዎች','Yaada maamiltootaa','Qiimaynta macaamiisha','ግምገማ ዓማዊል'],
 ['Completed Tracking','የተጠናቀቁ ክትትሎች','Hordoffii xumurame','Raadraacyada dhammaaday','ዝተዛዘመ ክትትል'],
 ['Recent tracking','የቅርብ ጊዜ የጭነት ክትትል','Hordoffii feʼumsaa dhihoo','Raadraacyadii ugu dambeeyay','ናይ ቀረባ እዋን ክትትል'],

 ['Open menu','ማውጫ ክፈት','Baafata bani','Fur liiska','ዝርዝር ክፈት'],
 ['Close menu','ማውጫ ዝጋ','Baafata cufi','Xir liiska','ዝርዝር ዕጸው'],
 ['Menu','ማውጫ','Baafata','Liiska','ዝርዝር'],
 ['Your workspace','የሥራ ማስተዳደሪያ','Bakka hojii keessan','Maamulka shaqadaada','መመሓደሪ ስራሕኩም'],
 ['Finish account setup','የመለያ ዝግጅትን ጨርስ','Qophii herregaa xumuri','Dhammaystir akoonka','ምድላው ሕሳብ ዛዝም'],
 ['Sign out','ውጣ','Baʼi','Ka bax','ውጻእ'],
 ['Sign-out could not finish. Please try again.','ከመለያዎ መውጣት አልተጠናቀቀም። እንደገና ይሞክሩ።','Herrega keessaa baʼuun hin xumuramne. Irra deebiʼaa yaalaa.','Ka bixitaanka akoonka ma dhammaystirmin. Fadlan mar kale isku day.','ካብ ሕሳብኩም ምውጻእ ኣይተዛዘመን። እንደገና ፈትኑ።'],
 ['Your driving workspace','መኪናዎንና ጭነቶችዎን ያስተዳድሩ','Konkolaataa fi feʼumsa keessan bulchaa','Maamul gaarigaaga iyo xamuulkaaga','መኪናኹምን ጽዕነትኩምን ኣመሓድሩ'],
 ['Your transport workspace','የትራንስፖርት ሥራዎን ያስተዳድሩ','Hojii geejjibaa keessan bulchaa','Maamul shaqadaada gaadiidka','ስራሕ መጓዓዝያኹም ኣመሓድሩ'],
 ['Close truck details','የመኪና ዝርዝርን ዝጋ','Odeeffannoo konkolaataa cufi','Xir faahfaahinta gaariga','ዝርዝር መኪና ዕጸው'],
 ['Close transporter results','የአጓጓዦች ውጤቶችን ዝጋ','Buʼaawwan geejjibdootaa cufi','Xir natiijooyinka gaadiidleyda','ውጽኢት ኣጓዓዝቲ ዕጸው'],
 ['Transporters','አጓጓዦች','Geejjibdoota','Gaadiidleyda','ኣጓዓዝቲ'],
 ['Partial capacity','ቀሪ የጭነት ቦታ አለ','Iddoo feʼumsaa hafe qaba','Boos xamuul ayaa ka bannaan','ዝተረፈ ቦታ ጽዕነት ኣሎ'],
] as const;
export const navigationMessages:Record<Locale,Messages>={en:{},am:{},om:{},so:{},ti:{}};
for(const [key,am,om,so,ti] of rows){navigationMessages.am[key]=am;navigationMessages.om[key]=om;navigationMessages.so[key]=so;navigationMessages.ti[key]=ti;}
