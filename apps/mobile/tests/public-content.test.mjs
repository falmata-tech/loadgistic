import test from 'node:test';
import assert from 'node:assert/strict';
import { externalDestination,programmeState } from '../src/api/public-content.ts';
test('public contact actions reject executable intents, credentials and mailbox injection',()=>{
 for(const value of ['intent://x','javascript:alert(1)','https://u:p@example.test','file:///tmp/x','mailto:a@example.test?bcc=other@example.test','tel:12345;run'])assert.equal(externalDestination(value),null);
 for(const value of ['tel:+251900000000','mailto:public@example.test','https://example.test/'])assert.equal(externalDestination(value),value);
});
test('programme labels use actual interval boundaries, not availability',()=>{
 const start='2026-10-05T05:30:00Z',end='2026-10-05T06:00:00Z';assert.equal(programmeState(start,end,Date.parse(start)-1),'Upcoming');assert.equal(programmeState(start,end,Date.parse(start)),'Featured now');assert.equal(programmeState(start,end,Date.parse(end)),'Finished');assert.equal(programmeState('',end,Date.now()),'');
});
