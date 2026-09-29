import {createHash} from 'node:crypto';
export function supportRevisionTag(value){return `"${createHash('sha256').update(JSON.stringify(value)).digest('hex')}"`;}
export function supportRevisionMatches(header,tag){return typeof header==='string'&&header.split(',').map(value=>value.trim()).includes(tag);}
