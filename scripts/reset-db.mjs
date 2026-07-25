import { resetDb } from '../src/lib/db.js';
const db=resetDb();
const counts={users:db.prepare('SELECT COUNT(*) AS n FROM users').get().n,organizations:db.prepare('SELECT COUNT(*) AS n FROM organizations').get().n,shipments:db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,capacities:db.prepare('SELECT COUNT(*) AS n FROM capacities').get().n};
console.log('Loadgistic local database reset:',counts);
