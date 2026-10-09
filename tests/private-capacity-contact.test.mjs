import test from 'node:test';
import assert from 'node:assert/strict';
import {privateCapacityContactName} from '../src/lib/private-capacity-contact.js';
test('contact labels accept native names and company names without inventing identity',()=>{
 for(const name of ['  አበበ  ', 'Dhaabbata Fe’umsaa', 'Shirkadda Gaadiidka', 'ጽዕነት ትራንስፖርት', 'A'])
  assert.equal(privateCapacityContactName(name),name.trim());
});
test('blank, oversized, multiline/control labels cannot enter the private contact command',()=>{
 for(const name of [null,undefined,42,'','  ','a'.repeat(101),'a\nb','a\u0000b','a\u007fb','a\u0085b'])
  assert.throws(()=>privateCapacityContactName(name),/CONTACT_NAME_REQUIRED/);
 assert.equal(privateCapacityContactName('a'.repeat(100)).length,100);
});
