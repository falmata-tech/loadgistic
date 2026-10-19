import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const directory=path.resolve(import.meta.dirname,'../../.local/telematics');
await mkdir(directory,{recursive:true,mode:0o700});
const config={id:randomUUID(),secret:randomBytes(32).toString('hex'),databasePassword:randomBytes(24).toString('hex'),bridgePassword:randomBytes(24).toString('hex')};
// Exclusive creation prevents accidental rotation of existing durable gateway data.
await writeFile(path.join(directory,'bootstrap.json'),JSON.stringify(config),{flag:'wx',mode:0o600});
await writeFile(path.join(directory,'compose.env'),`GATEWAY_ID=${config.id}\nGATEWAY_SECRET=${config.secret}\nGATEWAY_DATABASE_PASSWORD=${config.databasePassword}\nGATEWAY_BRIDGE_PASSWORD=${config.bridgePassword}\nTRACCAR_API_TOKEN=not-configured\n`,{flag:'wx',mode:0o600});
console.log('Created protected isolated configuration under .local/telematics. Existing configuration was not rotated.');
