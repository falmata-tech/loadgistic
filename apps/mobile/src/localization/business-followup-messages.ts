import type {Locale,Messages} from './controller';

// Fixed native workspace and Tracking sharing copy. Names, emails and notes stay raw.
const rows=[
 ['Add to this business','ለዚህ ድርጅት ያጋሩ','Dhaabbata kanatti idaʼi'],
 ['Add viewer','ተከታታይ ጨምር','Nama hordofu dabali'],
 ['Business access is inactive.','የድርጅቱ መዳረሻ አሁን አይሰራም።','Seensi dhaabbataa yeroo ammaa hin hojjatu.'],
 ['Coordinate with your team','ከቡድንዎ ጋር ያስተባብሩ','Garee keessan waliin qindeessaa'],
 ['Could not load this workspace. Please try again.','የሥራ ቦታውን መክፈት አልተቻለም። እንደገና ይሞክሩ።','Bakka hojii kana banuun hin dandaʼamne. Irra deebiʼii yaalaa.'],
 ['Could not save changes.','ለውጦቹን ማስቀመጥ አልተቻለም።','Jijjiirama kuusuu hin dandaʼamne.'],
 ['Current viewers','አሁን የሚከታተሉ','Namoota amma hordofan'],
 ['Former team member','የቀድሞ የቡድን አባል','Miseensa garee duraanii'],
 ['Invitation saved, but email delivery failed. Use Resend.','ግብዣው ተቀምጧል፣ ኢሜይሉ ግን አልደረሰም። «እንደገና ላክ» ይጠቀሙ።','Affeerraan kuufameera, garuu iimeeliin hin geenye. “Irra deebiʼii ergi” filadhaa.'],
 ['Loading sharing…','የማጋራት መረጃ እየተጫነ ነው…','Odeeffannoo qooddannaa feʼaa jira…'],
 ['Loading your workspaces','የሥራ ቦታዎችዎ እየተጫኑ ናቸው','Bakka hojii keessan feʼaa jira'],
 ['No map or shipment access','ካርታና ጭነት ማየት አይችልም','Kaartaa yookaan feʼumsa ilaaluu hin dandaʼu'],
 ['No viewers added.','እስካሁን ተከታታይ አልተጨመረም።','Namni hordofu hin dabalamiin.'],
 ['Create or join a shipper or broker team from Account.','ከመለያዎ የጭነት ላኪ ወይም ደላላ ቡድን ይፍጠሩ ወይም ይቀላቀሉ።','Herrega kee irraa garee abbaa feʼumsaa ykn daldalaa giddu-galeessaa uumi yookaan itti makami.'],
 ['Permitted team members can see the route and status. Only staff you select can see vehicle location.','ፈቃድ ያላቸው የቡድን አባላት መስመሩንና ሁኔታውን ማየት ይችላሉ። የመኪናውን ቦታ የሚያዩት እርስዎ የመረጧቸው ሠራተኞች ብቻ ናቸው።','Miseensonni garee hayyama qaban karaa fi haala feʼumsaa ni argu. Bakka konkolaataa kan argu hojjettoota isin filattan qofa.'],
 ['Please sign in again.','እንደገና ይግቡ።','Irra deebiʼii seenaa.'],
 ['Remove from business','ከድርጅቱ አስወግድ','Dhaabbata irraa haqi'],
 ['Remove viewer','ተከታታዩን አስወግድ','Nama hordofu haqi'],
 ['Share tracking','ክትትሉን ያጋሩ','Hordoffii qoodi'],
 ['Sign in to view your invitations.','ግብዣዎችዎን ለማየት ይግቡ።','Afeerraa keessan ilaaluuf seenaa.'],
 ['Verify your email to view your invitations.','ግብዣዎችዎን ለማየት ኢሜይልዎን ያረጋግጡ።','Afeerraa keessan ilaaluuf iimeelii keessan mirkaneessaa.'],
 ['Shipment owner','የጭነቱ ባለቤት','Abbaa feʼumsaa'],
 ['Their permitted team members will no longer see this vehicle.','ፈቃድ ያላቸው የቡድኑ አባላት ከዚህ በኋላ ይህን መኪና አያዩም።','Miseensonni garee isaanii hayyama qaban kana booda konkolaataa kana hin argan.'],
 ['This member will lose access to this business.','ይህ አባል የድርጅቱን መዳረሻ ያጣል።','Miseensi kun seensa dhaabbata kanaa ni dhaba.'],
 ['Verify the shipment owner email to manage sharing.','ማጋራትን ለማስተዳደር የጭነቱ ባለቤት ኢሜይልን ያረጋግጡ።','Qooddannaa bulchuuf iimeelii abbaa feʼumsaa mirkaneessaa.'],
 ['Viewer email','የተከታታዩ ኢሜይል','Iimeelii nama hordofuu'],
 ['Viewer name','የተከታታዩ ስም','Maqaa nama hordofuu'],
 ['Viewers can follow the route and shipment status. Vehicle location stays private.','ተከታታዮች የጭነቱን መስመርና ሁኔታ ማየት ይችላሉ። የመኪናው ቦታ በግል ይቀራል።','Namoonni hordofan karaa fi haala feʼumsaa ni argu. Bakki konkolaataa dhuunfaa taʼee hafa.']
] as const;

export const businessFollowupMessages:Record<Locale,Messages>={en:{},am:{},om:{}};
for(const [key,am,om] of rows){
 businessFollowupMessages.am[key]=am;
 businessFollowupMessages.om[key]=om;
}
