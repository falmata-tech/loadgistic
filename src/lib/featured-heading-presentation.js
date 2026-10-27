export const FEATURED_PUBLIC_HEADING='Daily Featured on TikTok LIVE';

const genericHeadlines=new Set(['daily featured transport providers',FEATURED_PUBLIC_HEADING.toLowerCase()]);
const genericIntroductions=new Set([
 'meet the transport accounts in today’s showcase.',
 'meet the transport accounts in today’s showcase and explore the vehicles they publish.'
]);

/** Keep a distinct saved day title as content, never as the programme identity. */
export function curatedFeaturedHeadline(value){
 const headline=typeof value==='string'?value.trim():'';
 return headline&&!genericHeadlines.has(headline.toLowerCase())?headline:'';
}

/** Keep a distinct saved introduction while omitting stock copy that repeats the board. */
export function curatedFeaturedIntroduction(value){
 const introduction=typeof value==='string'?value.trim():'';
 return introduction&&!genericIntroductions.has(introduction.toLowerCase())?introduction:'';
}
