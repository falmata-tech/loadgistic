import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd();
const iconSource=await fs.readFile(path.join(root,'public','icon.svg'),'utf8');
const maskableSource=iconSource.replace('rx="108"','rx="0"');
const foregroundSource=iconSource.replace(/\s*<rect x="16" y="16" width="480" height="480" rx="108" fill="url\(#navy\)"\/>/,'');
const monochromeSource=foregroundSource.replaceAll('fill="#155EEF"','fill="#fff"');
const backgroundSource='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0B1D3A"/></svg>';

async function render(source,output,size){
  await sharp(Buffer.from(source)).resize(size,size).png().toFile(output);
}

const brandSource=path.join(root,'public','brand','loadgistic-wordmark.png');
const {data:sourcePixels,info}=await sharp(brandSource).ensureAlpha().raw().toBuffer({resolveWithObject:true});

function wordmarkPixels(onDark){
  const pixels=Buffer.from(sourcePixels);
  for(let index=0;index<pixels.length;index+=4){
    const alpha=pixels[index+3];
    if(alpha===0)continue;
    const r=pixels[index],g=pixels[index+1],b=pixels[index+2];
    const x=(index/4)%info.width;
    const isWhite=r>220&&g>220&&b>220;
    const isNavy=r<80&&g<80&&b<130;
    if(isWhite){pixels[index]=255;pixels[index+1]=255;pixels[index+2]=255;}
    else if(isNavy){
      const useWhite=onDark&&x>370;
      pixels[index]=useWhite?255:11;
      pixels[index+1]=useWhite?255:29;
      pixels[index+2]=useWhite?255:58;
    }else{
      pixels[index]=21;pixels[index+1]=94;pixels[index+2]=239;
    }
  }
  return pixels;
}

const primaryWordmark=wordmarkPixels(false);
const darkWordmark=wordmarkPixels(true);
const lightWordmarkPath=path.join(root,'public','brand','loadgistic-wordmark-blue.png');
const darkWordmarkPath=path.join(root,'public','brand','loadgistic-wordmark-on-dark.png');
await sharp(primaryWordmark,{raw:info}).png().toFile(lightWordmarkPath);
const contrastBorder='<svg xmlns="http://www.w3.org/2000/svg" width="1510" height="390"><rect x="37" y="36" width="314" height="332" rx="70" fill="none" stroke="#fff" stroke-width="5"/></svg>';
await sharp(darkWordmark,{raw:info}).composite([{input:Buffer.from(contrastBorder)}]).png().toFile(darkWordmarkPath);
await fs.copyFile(lightWordmarkPath,path.join(root,'apps','mobile','assets','loadgistic-wordmark.png'));
await fs.copyFile(darkWordmarkPath,path.join(root,'apps','mobile','assets','loadgistic-wordmark-on-dark.png'));

const outputs=[
  {path:path.join(root,'public','favicon-32.png'),size:32,source:iconSource},
  {path:path.join(root,'public','icon-192.png'),size:192,source:iconSource},
  {path:path.join(root,'public','icon-512.png'),size:512,source:iconSource},
  {path:path.join(root,'public','icon-maskable-512.png'),size:512,source:maskableSource},
  {path:path.join(root,'public','apple-touch-icon.png'),size:180,source:maskableSource},
  {path:path.join(root,'public','brand','loadgistic-icon.png'),size:512,source:iconSource},
  {path:path.join(root,'apps','mobile','assets','loadgistic-icon.png'),size:512,source:iconSource},
  {path:path.join(root,'apps','mobile','assets','favicon.png'),size:48,source:iconSource},
  {path:path.join(root,'apps','mobile','assets','android-icon-foreground.png'),size:512,source:foregroundSource},
  {path:path.join(root,'apps','mobile','assets','android-icon-monochrome.png'),size:512,source:monochromeSource},
  {path:path.join(root,'apps','mobile','assets','android-icon-background.png'),size:512,source:backgroundSource}
];

for(const output of outputs)await render(output.source,output.path,output.size);
console.log(`Generated ${outputs.length+2} Loadgistic brand assets.`);
