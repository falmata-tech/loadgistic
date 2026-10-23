import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const source=path.join(root,'resources/marketing/prelaunch');
const output=path.join(root,'.local/play-store-20261010/prelaunch');
const campaign=JSON.parse(await readFile(path.join(source,'campaign.json'),'utf8'));
assert.equal(campaign.brand,'Loadgistic');
assert.equal(campaign.website,'https://loadgistic.com');
await mkdir(output,{recursive:true});
const artwork=await readFile(path.join(source,'east-africa-yard-portrait-cobalt.png'));
const wideArtwork=await readFile(path.join(source,'east-africa-yard-wide-cobalt.png'));
const iconSource=await readFile(path.join(root,'public/icon.svg'),'utf8');
const icon=iconSource.slice(iconSource.indexOf('>')+1,iconSource.lastIndexOf('</svg>'));
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const layouts={reel:{brand:350,headline:558,size:74,status:706,website:780},feed:{brand:160,headline:368,size:72,status:516,website:590},square:{brand:60,headline:232,size:64,status:364,website:432}};
const assets=[];
async function poster(format,headline,name){
 const {width,height,id,status}=format,layout=layouts[id];
 const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
 <defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#041a2e" stop-opacity=".85"/><stop offset=".7" stop-color="#041a2e" stop-opacity=".6"/><stop offset="1" stop-color="#041a2e" stop-opacity="0"/></linearGradient></defs>
 <rect width="${width}" height="${layout.website+100}" fill="url(#shade)"/>
 <svg x="92" y="${layout.brand}" width="80" height="80" viewBox="0 0 512 512">${icon}</svg>
 <text x="194" y="${layout.brand+59}" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="57" letter-spacing="-1.5">Load<tspan fill="#155eef">gistic</tspan></text>
 ${headline.map((line,index)=>`<text x="92" y="${layout.headline+index*(layout.size+8)}" fill="#fff" font-family="Arial,sans-serif" font-weight="700" font-size="${layout.size}" letter-spacing="-1.7">${escape(line)}</text>`).join('')}
 <rect x="92" y="${layout.status-34}" width="424" height="48" rx="24" fill="#155eef"/>
 <text x="115" y="${layout.status}" fill="#fff" font-family="Arial,sans-serif" font-weight="600" font-size="26">${escape(status)}</text>
 <text x="94" y="${layout.website}" fill="#e9f1f3" font-family="Arial,sans-serif" font-size="27">loadgistic.com</text>
 </svg>`);
 const bytes=await sharp(id==='square'?wideArtwork:artwork).resize(width,height,{fit:'cover',position:id==='square'?'east':'centre'}).composite([{input:overlay}]).flatten({background:'#0b1d3a'}).removeAlpha().png().toBuffer();
 const metadata=await sharp(bytes).metadata();
 assert.equal(metadata.width,width);assert.equal(metadata.height,height);assert.equal(metadata.channels,3);
 await writeFile(path.join(output,name),bytes);
 assets.push({file:name,width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),type:'promotional_artwork_not_app_screenshot'});
}
for(const format of campaign.formats)await poster(format,format.headline,`coming-soon-${format.id}.png`);
await poster(campaign.formats[0],['Know who','has space.'],'reel-space.png');
await poster(campaign.formats[0],['Put your network','to work.'],'reel-plan.png');
const mark=await sharp(Buffer.from(iconSource)).resize(560,560).png().toBuffer();
const avatar=await sharp({create:{width:720,height:720,channels:3,background:'#fff'}}).composite([{input:mark,left:80,top:80}]).png().toBuffer();
await writeFile(path.join(output,'profile-icon-white-720.png'),avatar);
await writeFile(path.join(output,'campaign.json'),JSON.stringify(campaign,null,2)+'\n');
await writeFile(path.join(output,'captions.txt'),Object.entries(campaign.captions).map(([language,posts])=>`[${language}]\n${Object.entries(posts).map(([name,text])=>`${name}\n${text}`).join('\n\n')}`).join('\n\n')+'\n');
await writeFile(path.join(output,'asset-evidence.json'),JSON.stringify({createdAt:new Date().toISOString(),brand:campaign.brand,aiAssisted:true,ownerVisualReviewPending:true,published:false,assets},null,2)+'\n');
console.log(JSON.stringify({output,assets:assets.map(({file,width,height,bytes})=>({file,width,height,bytes})),published:false}));
