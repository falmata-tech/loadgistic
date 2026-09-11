import { normalizePlace } from './route-matching.js';
import { placeLocalName } from './place-labels.js';

const PLACE_COORDINATES = Object.freeze({
  'addis ababa': { name:'Addis Ababa', lat:9.03, lng:38.74 },
  adama: { name:'Adama', lat:8.54, lng:39.27 },
  'bahir dar': { name:'Bahir Dar', lat:11.59, lng:37.39 },
  bishoftu: { name:'Bishoftu', lat:8.75, lng:38.99 },
  dessie: { name:'Dessie', lat:11.13, lng:39.63 },
  'dire dawa': { name:'Dire Dawa', lat:9.60, lng:41.87 },
  gambela: { name:'Gambela', lat:8.25, lng:34.59 },
  gondar: { name:'Gondar', lat:12.60, lng:37.47 },
  harar: { name:'Harar', lat:9.31, lng:42.12 },
  hawassa: { name:'Hawassa', lat:7.06, lng:38.48 },
  'jijiga': { name:'Jijiga', lat:9.35, lng:42.80 },
  jimma: { name:'Jimma', lat:7.67, lng:36.83 },
  mekelle: { name:'Mekelle', lat:13.50, lng:39.48 },
  nekemte: { name:'Nekemte', lat:9.09, lng:36.55 },
  'shashamane': { name:'Shashamane', lat:7.20, lng:38.60 },
  semera: { name:'Semera', lat:11.79, lng:41.01 },
  wolaita: { name:'Wolaita', lat:6.86, lng:37.76 },
  'wolaita sodo': { name:'Wolaita Sodo', lat:6.86, lng:37.76 },
  arba_minch: { name:'Arba Minch', lat:6.04, lng:37.55 },
  'arba minch': { name:'Arba Minch', lat:6.04, lng:37.55 },
  asella: { name:'Asella', lat:7.95, lng:39.13 },
  axum: { name:'Axum', lat:14.13, lng:38.72 },
  bale_robe: { name:'Bale Robe', lat:7.12, lng:40.00 },
  'bale robe': { name:'Bale Robe', lat:7.12, lng:40.00 },
  debre_birhan: { name:'Debre Birhan', lat:9.68, lng:39.53 },
  'debre birhan': { name:'Debre Birhan', lat:9.68, lng:39.53 },
  debre_markos: { name:'Debre Markos', lat:10.34, lng:37.73 },
  'debre markos': { name:'Debre Markos', lat:10.34, lng:37.73 },
  dilla: { name:'Dilla', lat:6.41, lng:38.31 },
  hosanna: { name:'Hosanna', lat:7.55, lng:37.85 },
  kombolcha: { name:'Kombolcha', lat:11.08, lng:39.74 },
  mettu: { name:'Mettu', lat:8.30, lng:35.58 },
  mojo: { name:'Mojo', lat:8.59, lng:39.12 },
  shire: { name:'Shire', lat:14.10, lng:38.28 },
  woldiya: { name:'Woldiya', lat:11.83, lng:39.60 }
  ,awash: { name:'Awash', lat:8.98, lng:40.17 }
  ,mieso: { name:'Mieso', lat:9.24, lng:40.75 }
  ,bati: { name:'Bati', lat:11.18, lng:40.02 }
  ,mille: { name:'Mille', lat:11.42, lng:40.77 }
  ,alamata: { name:'Alamata', lat:12.42, lng:39.56 }
  ,adigrat: { name:'Adigrat', lat:14.28, lng:39.46 }
  ,batu: { name:'Batu', lat:7.93, lng:38.72 }
  ,sodo: { name:'Sodo', lat:6.86, lng:37.76 }
  ,wolkite: { name:'Wolkite', lat:8.28, lng:37.78 }
  ,'mizan aman': { name:'Mizan Aman', lat:7.00, lng:35.58 }
  ,ambo: { name:'Ambo', lat:8.98, lng:37.85 }
  ,gimbi: { name:'Gimbi', lat:9.17, lng:35.83 }
  ,assosa: { name:'Assosa', lat:10.07, lng:34.53 }
  ,bedele: { name:'Bedele', lat:8.46, lng:36.35 }
  ,metu: { name:'Metu', lat:8.30, lng:35.58 }
  ,gambella: { name:'Gambella', lat:8.25, lng:34.59 }
  ,'debre tabor': { name:'Debre Tabor', lat:11.86, lng:38.00 }
  ,degehabur: { name:'Degehabur', lat:8.22, lng:43.56 }
  ,'kebri dehar': { name:'Kebri Dehar', lat:6.74, lng:44.27 }
  ,konso: { name:'Konso', lat:5.34, lng:37.44 }
  ,yabelo: { name:'Yabelo', lat:4.88, lng:38.08 }
  ,tepi: { name:'Tepi', lat:7.20, lng:35.42 }
  ,bonga: { name:'Bonga', lat:7.27, lng:36.23 }
  ,holeta: { name:'Holeta', lat:9.06, lng:38.50 }
  ,sululta: { name:'Sululta', lat:9.18, lng:38.75 }
  ,sebeta: { name:'Sebeta', lat:8.91, lng:38.62 }
  ,welenchiti: { name:'Welenchiti', lat:8.67, lng:39.43 }
  ,dangila: { name:'Dangila', lat:11.27, lng:36.83 }
  ,bure: { name:'Bure', lat:10.70, lng:37.07 }
  ,wukro: { name:'Wukro', lat:13.79, lng:39.60 }
  ,agula: { name:'Agula', lat:13.70, lng:39.58 }
  ,'abi adi': { name:'Abi Adi', lat:13.18, lng:38.93 }
  ,adwa: { name:'Adwa', lat:14.17, lng:38.90 }
  ,chifra: { name:'Chifra', lat:11.60, lng:40.02 }
  ,'eli dar': { name:'Eli Dar', lat:12.28, lng:42.12 }
  ,asayita: { name:'Asayita', lat:11.57, lng:41.44 }
  ,gewaane: { name:'Gewane', lat:10.17, lng:40.65 }
  ,'tog wajale': { name:'Tog Wajale', lat:9.60, lng:43.34 }
  ,babile: { name:'Babile', lat:9.21, lng:42.33 }
  ,bedeno: { name:'Bedeno', lat:8.92, lng:41.87 }
  ,shinile: { name:'Shinile', lat:9.68, lng:41.84 }
  ,'arsi negele': { name:'Arsi Negele', lat:7.35, lng:38.70 }
  ,butajira: { name:'Butajira', lat:8.12, lng:38.37 }
  ,jinka: { name:'Jinka', lat:5.79, lng:36.57 }
  ,menge: { name:'Menge', lat:10.39, lng:34.78 }
  ,bambasi: { name:'Bambasi', lat:9.75, lng:34.73 }
  ,tongo: { name:'Tongo', lat:10.00, lng:34.20 }
  ,kurmuk: { name:'Kurmuk', lat:10.55, lng:34.28 }
  ,itang: { name:'Itang', lat:8.20, lng:34.27 }
  ,abobo: { name:'Abobo', lat:7.85, lng:34.55 }
  ,'dembi dolo': { name:'Dembi Dolo', lat:8.53, lng:34.80 }
  ,maji: { name:'Maji', lat:6.21, lng:35.58 }
  ,dima: { name:'Dima', lat:6.54, lng:35.30 }
  ,meki: { name:'Meki', lat:8.15, lng:38.82 }
  ,erer: { name:'Erer', lat:9.5572445, lng:41.3853974 }
  ,'maya city': { name:'Maya City', lat:9.3972116, lng:42.0012638 }
  ,jigjiga: { name:'Jigjiga', lat:9.35, lng:42.80 }
  ,chinaksen: { name:'Chinaksen', lat:9.5060137, lng:42.6088587 }
  ,'tuli guled': { name:'Tuli Guled', lat:9.6150868, lng:42.7530108 }
  ,'kebri beyah': { name:'Kebri Beyah', lat:9.1000628, lng:43.1786727 }
  ,dubti: { name:'Dubti', lat:11.7368315, lng:41.0840355 }
  ,logiya: { name:'Logiya', lat:11.7230913, lng:40.976098 }
  ,sardo: { name:'Sardo', lat:11.9584793, lng:41.3018957 }
  ,'hagere selam': { name:'Hagere Selam', lat:13.65, lng:39.16 }
  ,quiha: { name:'Quiha', lat:13.47, lng:39.55 }
  ,samre: { name:'Samre', lat:13.19, lng:39.20 }
  ,'wondo genet': { name:'Wondo Genet', lat:7.0854757, lng:38.6141113 }
  ,shamena: { name:'Shamena', lat:7.0818986, lng:38.2925877 }
  ,leku: { name:'Leku', lat:6.8748617, lng:38.4417642 }
  ,'aleta wondo': { name:'Aleta Wondo', lat:6.6037191, lng:38.4232728 }
  ,chencha: { name:'Chencha', lat:6.25, lng:37.57 }
  ,sawla: { name:'Sawla', lat:6.30, lng:36.88 }
  ,gubre: { name:'Gubre', lat:8.2071534, lng:37.7902814 }
  ,tapo: { name:'Tapo', lat:8.3587156, lng:37.6721138 }
  ,goru: { name:'Goru', lat:8.400467, lng:37.8687407 }
  ,emidir: { name:'Emdibir', lat:8.119994, lng:37.9282961 }
  ,abelti: { name:'Abelti', lat:8.1750798, lng:37.5733515 }
  ,weliso: { name:'Weliso', lat:8.5388595, lng:37.9761854 }
  ,homosha: { name:'Homosha', lat:10.3136262, lng:34.632436 }
  ,gog: { name:'Gog', lat:7.5775408, lng:34.5025628 }
  ,shebel: { name:'Shebel', lat:8.4891255, lng:34.5841097 }
  ,merawi: { name:'Merawi', lat:11.41795, lng:37.16029 }
  ,'tis abay': { name:'Tis Abay', lat:11.4861727, lng:37.5858073 }
  ,wereta: { name:'Wereta', lat:11.923671, lng:37.696427 }
});

export const ETHIOPIA_PLACES = Object.freeze(
  [...new Map(Object.values(PLACE_COORDINATES).map(place => [place.name,place])).values()]
    .sort((a,b) => a.name.localeCompare(b.name))
);

export function getPlaceCoordinate(value) {
  return PLACE_COORDINATES[normalizePlace(placeLocalName(value))] || null;
}

export function nearestEthiopiaPlace(lat,lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return ETHIOPIA_PLACES.map(place => {
    const latitudeScale = 111;
    const longitudeScale = 111 * Math.cos((lat * Math.PI) / 180);
    const distanceKm = Math.hypot((place.lat-lat)*latitudeScale,(place.lng-lng)*longitudeScale);
    return {...place,distanceKm};
  }).sort((a,b) => a.distanceKm-b.distanceKm)[0] || null;
}
