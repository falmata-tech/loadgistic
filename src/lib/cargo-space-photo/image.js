import sharp from 'sharp';
import {privateUploadMaxBytes} from '../upload-policy.js';

const inputFormats={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};

// Re-encoding strips EXIF, GPS coordinates, comments and the original filename.
export async function prepareCargoSpacePhoto(file){
 if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('PHOTO_REQUIRED');
 if(file.size>privateUploadMaxBytes())throw new Error('FILE_TOO_LARGE');
 const format=inputFormats[String(file.type||'').toLowerCase()];
 if(!format)throw new Error('PHOTO_IMAGE_INVALID');
 const bytes=Buffer.from(await file.arrayBuffer());
 if(bytes.length!==file.size)throw new Error('PHOTO_IMAGE_INVALID');
 try{
  const image=sharp(bytes,{limitInputPixels:25_000_000,failOn:'warning'}).timeout({seconds:5});
  const metadata=await image.metadata();
  if(metadata.format!==format||(metadata.pages||1)!==1)throw new Error('PHOTO_IMAGE_INVALID');
  const normalized=await image.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true})
   .jpeg({quality:84,mozjpeg:true}).toBuffer();
  if(!normalized.length||normalized.length>privateUploadMaxBytes())throw new Error('FILE_TOO_LARGE');
  return new File([normalized],'cargo-space.jpg',{type:'image/jpeg'});
 }catch(error){
  if(error instanceof Error&&error.message==='FILE_TOO_LARGE')throw error;
  throw new Error('PHOTO_IMAGE_INVALID');
 }
}
