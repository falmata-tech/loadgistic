import sharp from 'sharp';
import {privateUploadMaxBytes} from './upload-policy.js';

const formats={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
export async function prepareDriverPortrait(file){
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('PORTRAIT_REQUIRED');
  if(file.size>privateUploadMaxBytes())throw new Error('FILE_TOO_LARGE');
  const format=formats[String(file.type||'').toLowerCase()];
  if(!format)throw new Error('PORTRAIT_IMAGE_INVALID');
  const bytes=Buffer.from(await file.arrayBuffer());
  if(bytes.length!==file.size)throw new Error('PORTRAIT_IMAGE_INVALID');
  try{
    const image=sharp(bytes,{limitInputPixels:25_000_000,failOn:'warning'}).timeout({seconds:5});
    const metadata=await image.metadata();
    if(metadata.format!==format||(metadata.pages||1)!==1)throw new Error('PORTRAIT_IMAGE_INVALID');
    // Sharp strips metadata by default; never call keepMetadata/withMetadata here.
    const normalized=await image.rotate().resize(512,512,{fit:'cover'}).jpeg({quality:85}).toBuffer();
    return new File([normalized],'portrait.jpg',{type:'image/jpeg'});
  }catch{throw new Error('PORTRAIT_IMAGE_INVALID');}
}
