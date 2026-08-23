import { distanceBetweenKm } from './domain.js';

function place(key,label,lat,lng){return Object.freeze({key,place_ref:`builtin:${key}`,label:`${label}, Ethiopia`,lat,lng});}

export const DEMO_PLACES=Object.freeze({
  addis:place('addis ababa','Addis Ababa',9.03,38.74),
  holeta:place('holeta','Holeta',9.06,38.50),
  sululta:place('sululta','Sululta',9.18,38.75),
  sebeta:place('sebeta','Sebeta',8.91,38.62),
  bishoftu:place('bishoftu','Bishoftu',8.75,38.99),
  mojo:place('mojo','Mojo',8.59,39.12),
  adama:place('adama','Adama',8.54,39.27),
  wenji:place('wenji','Wenji',8.4540959,39.2175166),
  welenchiti:place('welenchiti','Welenchiti',8.67,39.43),
  asella:place('asella','Asella',7.95,39.13),
  meki:place('meki','Meki',8.15,38.82),
  awash:place('awash','Awash',8.98,40.17),
  mieso:place('mieso','Mieso',9.24,40.75),
  direDawa:place('dire dawa','Dire Dawa',9.60,41.85),
  melkaJebdu:place('melka jebdu','Melka Jebdu',9.6193211,41.7836794),
  shinile:place('shinile','Shinile',9.68,41.84),
  erer:place('erer','Erer',9.57,41.38),
  mayaCity:place('maya city','Maya City',9.3972116,42.0012638),
  harar:place('harar','Harar',9.31,42.13),
  kembolchaHarar:place('kembolcha harar','Kembolcha',9.4353986,42.1181916),
  babile:place('babile','Babile',9.21,42.33),
  bedeno:place('bedeno','Bedeno',8.92,41.87),
  jigjiga:place('jigjiga','Jigjiga',9.35,42.80),
  xoodhleey:place('xoodhleey','Xoodhleey',9.3079659,42.9101754),
  chinaksen:place('chinaksen','Chinaksen',9.5060137,42.6088587),
  tuliGuled:place('tuli guled','Tuli Guled',9.6150868,42.7530108),
  togWajale:place('tog wajale','Tog Wajale',9.60,43.34),
  kebriBeyah:place('kebri beyah','Kebri Beyah',9.1000628,43.1786727),
  debreBirhan:place('debre birhan','Debre Birhan',9.68,39.53),
  kombolcha:place('kombolcha','Kombolcha',11.08,39.74),
  dessie:place('dessie','Dessie',11.13,39.63),
  woldiya:place('woldiya','Woldiya',11.83,39.60),
  bati:place('bati','Bati',11.18,40.02),
  mille:place('mille','Mille',11.42,40.77),
  semera:place('semera','Semera',11.79,41.01),
  tendaho:place('tendaho','Tendaho',11.6921666,40.9531065),
  dubti:place('dubti','Dubti',11.7368315,41.0840355),
  logiya:place('logiya','Logiya',11.7230913,40.976098),
  sardo:place('sardo','Sardo',11.9584793,41.3018957),
  chifra:place('chifra','Chifra',11.60,40.02),
  asayita:place('asayita','Asayita',11.57,41.44),
  alamata:place('alamata','Alamata',12.42,39.56),
  mekelle:place('mekelle','Mekelle',13.50,39.47),
  aynalem:place('aynalem','Aynalem',13.4557615,39.4890041),
  wukro:place('wukro','Wukro',13.79,39.60),
  agula:place('agula','Agula',13.70,39.58),
  hagereSelam:place('hagere selam','Hagere Selam',13.65,39.16),
  quiha:place('quiha','Quiha',13.47,39.55),
  samre:place('samre','Samre',13.19,39.20),
  adigrat:place('adigrat','Adigrat',14.28,39.46),
  batu:place('batu','Batu',7.93,38.72),
  shashamane:place('shashamane','Shashamane',7.20,38.60),
  hawassa:place('hawassa','Hawassa',7.05,38.47),
  wondoGenet:place('wondo genet','Wondo Genet',7.0854757,38.6141113),
  shamena:place('shamena','Shamena',7.0818986,38.2925877),
  leku:place('leku','Leku',6.8748617,38.4417642),
  aletaWondo:place('aleta wondo','Aleta Wondo',6.6037191,38.4232728),
  dilla:place('dilla','Dilla',6.41,38.31),
  sodo:place('sodo','Sodo',6.86,37.76),
  arbaMinch:place('arba minch','Arba Minch',6.04,37.55),
  dorze:place('dorze','Dorze',6.1948568,37.5743447),
  chencha:place('chencha','Chencha',6.25,37.57),
  konso:place('konso','Konso',5.34,37.44),
  sawla:place('sawla','Sawla',6.30,36.88),
  yabelo:place('yabelo','Yabelo',4.88,38.08),
  mega:place('mega','Mega',4.05,38.32),
  moyale:place('moyale','Moyale',3.54417,39.05423),
  burjiMoyale:place('burji moyale','Burji',3.5205,39.078),
  chamuk:place('chamuk','Chamuk',3.5845,39.054),
  wolkite:place('wolkite','Wolkite',8.28,37.78),
  gubre:place('gubre','Gubre',8.2071534,37.7902814),
  tapo:place('tapo','Tapo',8.3587156,37.6721138),
  goru:place('goru','Goru',8.400467,37.8687407),
  emdibir:place('emidir','Emdibir',8.119994,37.9282961),
  abelti:place('abelti','Abelti',8.1750798,37.5733515),
  weliso:place('weliso','Weliso',8.5388595,37.9761854),
  butajira:place('butajira','Butajira',8.12,38.37),
  hosanna:place('hosanna','Hosanna',7.55,37.85),
  jimma:place('jimma','Jimma',7.67,36.83),
  mizanAman:place('mizan aman','Mizan Aman',7.00,35.58),
  bendi:place('bendi','Bendi',7.0711782,35.6442129),
  tepi:place('tepi','Tepi',7.20,35.42),
  bonga:place('bonga','Bonga',7.27,36.23),
  maji:place('maji','Maji',6.21,35.58),
  dima:place('dima','Dima',6.54,35.30),
  ambo:place('ambo','Ambo',8.98,37.85),
  nekemte:place('nekemte','Nekemte',9.09,36.55),
  gimbi:place('gimbi','Gimbi',9.17,35.83),
  assosa:place('assosa','Assosa',10.07,34.53),
  asosaTown:place('asosa town','Asosa',10.0646352,34.5437024),
  menge:place('menge','Menge',10.39,34.78),
  bambasi:place('bambasi','Bambasi',9.75,34.73),
  tongo:place('tongo','Tongo',10.00,34.20),
  homosha:place('homosha','Homosha',10.3136262,34.632436),
  bedele:place('bedele','Bedele',8.46,36.35),
  metu:place('metu','Metu',8.30,35.58),
  gambella:place('gambella','Gambella',8.25,34.59),
  abole:place('abole','Abole',8.2258202,34.4361734),
  itang:place('itang','Itang',8.20,34.27),
  abobo:place('abobo','Abobo',7.85,34.55),
  gog:place('gog','Gog',7.5775408,34.5025628),
  shebel:place('shebel','Shebel',8.4891255,34.5841097),
  dembiDolo:place('dembi dolo','Dembi Dolo',8.53,34.80),
  debreMarkos:place('debre markos','Debre Markos',10.34,37.73),
  bahirDar:place('bahir dar','Bahir Dar',11.59,37.39),
  sebatamit:place('sebatamit','Sebatamit',11.5344712,37.4050713),
  merawi:place('merawi','Merawi',11.41795,37.16029),
  dangila:place('dangila','Dangila',11.27,36.83),
  tisAbay:place('tis abay','Tis Abay',11.4861727,37.5858073),
  wereta:place('wereta','Wereta',11.923671,37.696427),
  gondar:place('gondar','Gondar',12.60,37.47),
  debreTabor:place('debre tabor','Debre Tabor',11.86,38.00),
  degehabur:place('degehabur','Degehabur',8.22,43.56),
  kebriDehar:place('kebri dehar','Kebri Dehar',6.74,44.27)
});

const P=DEMO_PLACES;
function route(key,...points){return Object.freeze({key,points:Object.freeze(points)});}

export const DEMO_LOCAL_ROUTES=Object.freeze({
  ADDIS_WEST:route('ADDIS_WEST',P.holeta,P.addis,P.sebeta),
  ADDIS_SOUTH:route('ADDIS_SOUTH',P.addis,P.bishoftu,P.mojo),
  ADAMA_NORTH:route('ADAMA_NORTH',P.adama,P.mojo,P.bishoftu),
  ADAMA_SOUTH:route('ADAMA_SOUTH',P.adama,P.asella),
  BAHIR_WEST:route('BAHIR_WEST',P.bahirDar,P.merawi,P.dangila),
  BAHIR_EAST:route('BAHIR_EAST',P.bahirDar,P.tisAbay,P.wereta),
  MEKELLE_NORTH:route('MEKELLE_NORTH',P.mekelle,P.agula,P.wukro),
  MEKELLE_SOUTH:route('MEKELLE_SOUTH',P.mekelle,P.quiha,P.samre),
  SEMERA_SOUTH:route('SEMERA_SOUTH',P.semera,P.dubti,P.mille),
  SEMERA_EAST:route('SEMERA_EAST',P.semera,P.dubti,P.asayita),
  JIGJIGA_WEST:route('JIGJIGA_WEST',P.jigjiga,P.babile,P.harar),
  JIGJIGA_SOUTH:route('JIGJIGA_SOUTH',P.jigjiga,P.kebriBeyah),
  HARAR_WEST:route('HARAR_WEST',P.harar,P.mayaCity,P.direDawa),
  HARAR_EAST:route('HARAR_EAST',P.harar,P.babile,P.jigjiga),
  DIRE_LOCAL:route('DIRE_LOCAL',P.direDawa,P.mayaCity,P.harar,P.babile),
  DIRE_WEST:route('DIRE_WEST',P.direDawa,P.shinile,P.erer),
  HAWASSA_NORTH:route('HAWASSA_NORTH',P.hawassa,P.wondoGenet,P.shashamane),
  HAWASSA_SOUTH:route('HAWASSA_SOUTH',P.hawassa,P.aletaWondo,P.dilla),
  WOLKITE_NORTH:route('WOLKITE_NORTH',P.wolkite,P.goru,P.weliso),
  WOLKITE_EAST:route('WOLKITE_EAST',P.wolkite,P.gubre,P.emdibir),
  ARBA_NORTH:route('ARBA_NORTH',P.arbaMinch,P.chencha,P.sodo),
  ARBA_SOUTH:route('ARBA_SOUTH',P.arbaMinch,P.konso),
  ASSOSA_NORTH:route('ASSOSA_NORTH',P.assosa,P.homosha,P.menge),
  ASSOSA_SOUTH:route('ASSOSA_SOUTH',P.assosa,P.bambasi),
  GAMBELLA_NORTH:route('GAMBELLA_NORTH',P.gambella,P.itang),
  GAMBELLA_SOUTH:route('GAMBELLA_SOUTH',P.gambella,P.abobo,P.gog),
  MIZAN_NORTH:route('MIZAN_NORTH',P.mizanAman,P.bonga),
  MIZAN_SOUTH:route('MIZAN_SOUTH',P.mizanAman,P.tepi),
  MOYALE_LOCAL:route('MOYALE_LOCAL',P.moyale,P.burjiMoyale,P.chamuk)
});

export const DEMO_DELIVERY_ROUTES=Object.freeze({
  ADDIS_SULULTA:route('ADDIS_SULULTA',P.addis,P.sululta),
  ADDIS_SEBETA:route('ADDIS_SEBETA',P.addis,P.sebeta),
  ADAMA_WENJI:route('ADAMA_WENJI',P.adama,P.wenji),
  ADAMA_MOJO:route('ADAMA_MOJO',P.adama,P.mojo),
  BAHIR_SEBATAMIT:route('BAHIR_SEBATAMIT',P.bahirDar,P.sebatamit),
  BAHIR_TIS_ABAY:route('BAHIR_TIS_ABAY',P.bahirDar,P.tisAbay),
  MEKELLE_AYNALEM:route('MEKELLE_AYNALEM',P.mekelle,P.aynalem),
  MEKELLE_QUIHA:route('MEKELLE_QUIHA',P.mekelle,P.quiha),
  SEMERA_LOGIYA:route('SEMERA_LOGIYA',P.semera,P.logiya),
  SEMERA_TENDAHO:route('SEMERA_TENDAHO',P.semera,P.tendaho),
  JIGJIGA_XOODHLEEY:route('JIGJIGA_XOODHLEEY',P.jigjiga,P.xoodhleey),
  JIGJIGA_CHINAKSEN:route('JIGJIGA_CHINAKSEN',P.jigjiga,P.chinaksen),
  HARAR_KEMBOLCHA:route('HARAR_KEMBOLCHA',P.harar,P.kembolchaHarar),
  HARAR_MAYA:route('HARAR_MAYA',P.harar,P.mayaCity),
  DIRE_MELKA_JEBDU:route('DIRE_MELKA_JEBDU',P.direDawa,P.melkaJebdu),
  DIRE_SHINILE:route('DIRE_SHINILE',P.direDawa,P.shinile),
  HAWASSA_WONDO:route('HAWASSA_WONDO',P.hawassa,P.wondoGenet),
  HAWASSA_LEKU:route('HAWASSA_LEKU',P.hawassa,P.leku),
  WOLKITE_GUBRE:route('WOLKITE_GUBRE',P.wolkite,P.gubre),
  WOLKITE_GORU:route('WOLKITE_GORU',P.wolkite,P.goru),
  ARBA_DORZE:route('ARBA_DORZE',P.arbaMinch,P.dorze),
  ARBA_CHENCHA:route('ARBA_CHENCHA',P.arbaMinch,P.chencha),
  ASSOSA_TOWN:route('ASSOSA_TOWN',P.assosa,P.asosaTown),
  ASSOSA_HOMOSHA:route('ASSOSA_HOMOSHA',P.assosa,P.homosha),
  GAMBELLA_ABOLE:route('GAMBELLA_ABOLE',P.gambella,P.abole),
  GAMBELLA_SHEBEL:route('GAMBELLA_SHEBEL',P.gambella,P.shebel),
  MIZAN_BENDI:route('MIZAN_BENDI',P.mizanAman,P.bendi),
  MIZAN_TEPI:route('MIZAN_TEPI',P.mizanAman,P.tepi),
  MOYALE_BURJI:route('MOYALE_BURJI',P.moyale,P.burjiMoyale),
  MOYALE_CHAMUK:route('MOYALE_CHAMUK',P.moyale,P.chamuk)
});

export const DEMO_ROAD_ROUTES=Object.freeze({
  CENTRAL_EAST:route('CENTRAL_EAST',P.addis,P.bishoftu,P.mojo,P.adama),
  EAST_TRADE:route('EAST_TRADE',P.adama,P.awash,P.mieso,P.direDawa),
  EASTERN:route('EASTERN',P.direDawa,P.harar,P.jigjiga),
  NORTH_EAST:route('NORTH_EAST',P.addis,P.debreBirhan,P.kombolcha,P.dessie,P.woldiya),
  TIGRAY:route('TIGRAY',P.woldiya,P.alamata,P.mekelle,P.adigrat),
  AFAR:route('AFAR',P.kombolcha,P.bati,P.mille,P.semera),
  SOUTH:route('SOUTH',P.mojo,P.batu,P.shashamane,P.hawassa),
  SOUTH_DEEP:route('SOUTH_DEEP',P.hawassa,P.sodo,P.arbaMinch),
  WEST_SOUTH:route('WEST_SOUTH',P.addis,P.wolkite,P.jimma,P.mizanAman),
  WEST:route('WEST',P.addis,P.ambo,P.nekemte,P.gimbi,P.assosa),
  SOUTHWEST:route('SOUTHWEST',P.jimma,P.bedele,P.metu,P.gambella),
  NORTHWEST:route('NORTHWEST',P.addis,P.debreMarkos,P.bahirDar,P.gondar),
  WOLKITE_HAWASSA:route('WOLKITE_HAWASSA',P.wolkite,P.hosanna,P.shashamane,P.hawassa),
  BAHIR_DESSIE:route('BAHIR_DESSIE',P.bahirDar,P.debreTabor,P.dessie),
  NORTH_TRUNK:route('NORTH_TRUNK',P.kombolcha,P.dessie,P.woldiya,P.alamata,P.mekelle),
  AFAR_SOUTH:route('AFAR_SOUTH',P.semera,P.mille,P.awash,P.adama),
  SOMALI_SOUTH:route('SOMALI_SOUTH',P.jigjiga,P.degehabur,P.kebriDehar),
  ARBA_YABELO:route('ARBA_YABELO',P.arbaMinch,P.konso,P.yabelo),
  ASSOSA_NEKEMTE:route('ASSOSA_NEKEMTE',P.assosa,P.gimbi,P.nekemte),
  GAMBELLA_ASSOSA:route('GAMBELLA_ASSOSA',P.gambella,P.dembiDolo,P.gimbi,P.assosa),
  MIZAN_JIMMA:route('MIZAN_JIMMA',P.mizanAman,P.tepi,P.bonga,P.jimma),
  HARAR_ADAMA:route('HARAR_ADAMA',P.harar,P.direDawa,P.mieso,P.awash,P.adama),
  MOYALE_NORTH:route('MOYALE_NORTH',P.moyale,P.mega,P.yabelo)
});

const R=DEMO_ROAD_ROUTES;
const L=DEMO_LOCAL_ROUTES;
const D=DEMO_DELIVERY_ROUTES;
export const DEMO_BASES=Object.freeze({
  addis:P.addis,adama:P.adama,bahirDar:P.bahirDar,mekelle:P.mekelle,semera:P.semera,jigjiga:P.jigjiga,harar:P.harar,direDawa:P.direDawa,
  hawassa:P.hawassa,wolkite:P.wolkite,arbaMinch:P.arbaMinch,assosa:P.assosa,gambella:P.gambella,mizanAman:P.mizanAman,moyale:P.moyale
});
const BASES=DEMO_BASES;

const LOCAL_ROUTES_BY_BASE=Object.freeze({
  addis:[L.ADDIS_WEST,L.ADDIS_SOUTH],adama:[L.ADAMA_NORTH,L.ADAMA_SOUTH],bahirDar:[L.BAHIR_WEST,L.BAHIR_EAST],
  mekelle:[L.MEKELLE_NORTH,L.MEKELLE_SOUTH],semera:[L.SEMERA_SOUTH,L.SEMERA_EAST],jigjiga:[L.JIGJIGA_WEST,L.JIGJIGA_SOUTH],
  harar:[L.HARAR_WEST,L.HARAR_EAST],direDawa:[L.DIRE_LOCAL,L.DIRE_WEST],hawassa:[L.HAWASSA_NORTH,L.HAWASSA_SOUTH],
  wolkite:[L.WOLKITE_NORTH,L.WOLKITE_EAST],arbaMinch:[L.ARBA_NORTH,L.ARBA_SOUTH],assosa:[L.ASSOSA_NORTH,L.ASSOSA_SOUTH],
  gambella:[L.GAMBELLA_NORTH,L.GAMBELLA_SOUTH],mizanAman:[L.MIZAN_NORTH,L.MIZAN_SOUTH],moyale:[L.MOYALE_LOCAL]
});

const DELIVERY_ROUTES_BY_BASE=Object.freeze({
  addis:[D.ADDIS_SULULTA,D.ADDIS_SEBETA],adama:[D.ADAMA_WENJI,D.ADAMA_MOJO],bahirDar:[D.BAHIR_SEBATAMIT,D.BAHIR_TIS_ABAY],
  mekelle:[D.MEKELLE_AYNALEM,D.MEKELLE_QUIHA],semera:[D.SEMERA_LOGIYA,D.SEMERA_TENDAHO],jigjiga:[D.JIGJIGA_XOODHLEEY,D.JIGJIGA_CHINAKSEN],
  harar:[D.HARAR_KEMBOLCHA,D.HARAR_MAYA],direDawa:[D.DIRE_MELKA_JEBDU,D.DIRE_SHINILE],hawassa:[D.HAWASSA_WONDO,D.HAWASSA_LEKU],
  wolkite:[D.WOLKITE_GUBRE,D.WOLKITE_GORU],arbaMinch:[D.ARBA_DORZE,D.ARBA_CHENCHA],assosa:[D.ASSOSA_TOWN,D.ASSOSA_HOMOSHA],
  gambella:[D.GAMBELLA_ABOLE,D.GAMBELLA_SHEBEL],mizanAman:[D.MIZAN_BENDI,D.MIZAN_TEPI],moyale:[D.MOYALE_BURJI,D.MOYALE_CHAMUK]
});

const REGIONAL_ROUTES_BY_BASE=Object.freeze({
  addis:[R.CENTRAL_EAST,R.NORTH_EAST,R.NORTHWEST,R.WEST_SOUTH,R.WEST],adama:[R.CENTRAL_EAST,R.EAST_TRADE],
  bahirDar:[R.NORTHWEST,R.BAHIR_DESSIE],mekelle:[R.TIGRAY,R.NORTH_TRUNK],semera:[R.AFAR,R.AFAR_SOUTH],jigjiga:[R.EASTERN,R.SOMALI_SOUTH],
  harar:[R.EASTERN,R.HARAR_ADAMA],direDawa:[R.EAST_TRADE,R.EASTERN],hawassa:[R.SOUTH,R.SOUTH_DEEP,R.WOLKITE_HAWASSA],
  wolkite:[R.WEST_SOUTH,R.WOLKITE_HAWASSA],arbaMinch:[R.SOUTH_DEEP,R.ARBA_YABELO],assosa:[R.WEST,R.ASSOSA_NEKEMTE],
  gambella:[R.SOUTHWEST,R.GAMBELLA_ASSOSA],mizanAman:[R.WEST_SOUTH,R.MIZAN_JIMMA],moyale:[R.MOYALE_NORTH]
});

const RAW_SERVICE_AREAS=Object.freeze({
  addis:[P.holeta,P.sululta,P.bishoftu,P.sebeta],
  adama:[P.welenchiti,P.asella,P.meki,P.mojo],
  bahirDar:[P.merawi,P.dangila,P.tisAbay,P.wereta],
  mekelle:[P.hagereSelam,P.wukro,P.quiha,P.samre],
  semera:[P.chifra,P.mille,P.asayita,P.sardo],
  jigjiga:[P.babile,P.chinaksen,P.tuliGuled,P.kebriBeyah],
  harar:[P.direDawa,P.mayaCity,P.babile,P.bedeno],
  direDawa:[P.erer,P.shinile,P.mayaCity,P.harar],
  hawassa:[P.shamena,P.leku,P.wondoGenet,P.shashamane],
  wolkite:[P.abelti,P.emdibir,P.goru,P.tapo],
  arbaMinch:[P.sodo,P.chencha,P.konso,P.sawla],
  assosa:[P.menge,P.homosha,P.tongo,P.bambasi],
  gambella:[P.itang,P.abobo,P.dembiDolo,P.shebel],
  mizanAman:[P.bonga,P.tepi,P.maji,P.dima],
  moyale:[P.burjiMoyale,P.chamuk,
    place('moyale west edge','West edge of Moyale',3.54417,38.94),place('moyale north edge','North edge of Moyale',3.66,39.05423)]
});

const LOCAL_RADIUS_BUCKETS=Object.freeze([20,50,70,100]);

function normalizedRef(value){return String(value||'').toLowerCase().replace('builtin:jijiga','builtin:jigjiga').trim();}
function orderedBoundary(center,points){return [...points].sort((a,b)=>Math.atan2(a.lat-center.lat,a.lng-center.lng)-Math.atan2(b.lat-center.lat,b.lng-center.lng));}

export function demoVehicleRangeClass(record={}){
  const configuration=String(record.cargo_configuration||record.vehicle_type||record.category||'');
  if(/courier|cargo van|pickup|mini/i.test(configuration))return 'DELIVERY';
  return /medium|heavy|trailer|curtain/i.test(configuration)?'REGIONAL':'LOCAL';
}

export function nearestDemoBase(record={}){
  const reference=normalizedRef(record.place_ref||record.location_place_ref||record.city_place_ref);
  const direct=Object.entries(BASES).find(([,candidate])=>normalizedRef(candidate.place_ref)===reference);
  if(direct)return {key:direct[0],place:direct[1]};
  const lat=Number(record.lat??record.location_lat??record.city_lat),lng=Number(record.lng??record.location_lng??record.city_lng);
  const nearest=Object.entries(BASES).map(([key,candidate])=>({key,place:candidate,distance:distanceBetweenKm({lat,lng},candidate)})).filter(item=>item.distance!==null).sort((a,b)=>a.distance-b.distance)[0];
  return nearest||{key:'addis',place:P.addis};
}

function routeChoices(record,base){
  const rangeClass=demoVehicleRangeClass(record);
  const catalog=rangeClass==='DELIVERY'?DELIVERY_ROUTES_BY_BASE:rangeClass==='REGIONAL'?REGIONAL_ROUTES_BY_BASE:LOCAL_ROUTES_BY_BASE;
  return catalog[base.key]||catalog.addis;
}

export function demoCurrentRouteForLocation(record,index=0){
  const base=nearestDemoBase(record);
  const choices=routeChoices(record,base);
  const selected=choices[Math.abs(index)%choices.length];
  const points=index%2===0?[...selected.points]:[...selected.points].reverse();
  return {base,key:selected.key,rangeClass:demoVehicleRangeClass(record),points};
}

export function demoRegularRoutesForBase(record,count=1){
  const base=nearestDemoBase(record);
  const choices=routeChoices(record,base);
  return Array.from({length:count},(_,index)=>choices[index%choices.length]);
}

export function demoServiceAreaForLocation(record){
  const base=nearestDemoBase(record);
  if(demoVehicleRangeClass(record)==='DELIVERY'){
    const kmPerLatitude=111.32;
    const kmPerLongitude=111.32*Math.cos(base.place.lat*Math.PI/180);
    const northSouth=13/kmPerLatitude;
    const eastWest=13/kmPerLongitude;
    const city=base.place.label.replace(', Ethiopia','');
    const boundary=orderedBoundary(base.place,[
      place(`${base.key} north edge`,`North edge of ${city}`,base.place.lat+northSouth,base.place.lng),
      place(`${base.key} east edge`,`East edge of ${city}`,base.place.lat,base.place.lng+eastWest),
      place(`${base.key} south edge`,`South edge of ${city}`,base.place.lat-northSouth,base.place.lng),
      place(`${base.key} west edge`,`West edge of ${city}`,base.place.lat,base.place.lng-eastWest)
    ]);
    return {base,center:base.place,boundary,radiusKm:20};
  }
  const boundary=orderedBoundary(base.place,RAW_SERVICE_AREAS[base.key]||RAW_SERVICE_AREAS.addis);
  const farthestKm=Math.max(...boundary.map(candidate=>distanceBetweenKm(base.place,candidate)));
  const radiusKm=LOCAL_RADIUS_BUCKETS.find(bucket=>farthestKm<=bucket+2)||LOCAL_RADIUS_BUCKETS.at(-1);
  return {base,center:base.place,boundary,radiusKm};
}
