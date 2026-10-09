const handlePattern=/^[a-z0-9][a-z0-9_-]{1,63}$/;
export function contentBlocks(value){
 try{const data=typeof value==='string'?JSON.parse(value):value;if(!Array.isArray(data))return[];
 return [...new Set(data.filter(item=>typeof item==='string'&&handlePattern.test(item)))].slice(0,100);
 }catch{return[];}
}
export function changeContentBlock(current,handle,blocked){
 if(!handlePattern.test(handle))throw Error('INVALID_PROVIDER');
 const previous=contentBlocks(current);if(blocked&&!previous.includes(handle)&&previous.length>=100)throw Error('BLOCK_LIST_FULL');
 return blocked?[...new Set([...previous,handle])]:previous.filter(item=>item!==handle);
}
