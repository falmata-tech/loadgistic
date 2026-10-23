import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('SMTP address parsing stays bounded for the advisory free-text inputs',()=>{
  // Exercise the installed library through its public API, without a network
  // transport. A subprocess timeout contains a future parser regression.
  const result=spawnSync(process.execPath,['--input-type=module','-e',`
    import nodemailer from 'nodemailer';
    const transport=nodemailer.createTransport({streamTransport:true,buffer:true});
    for(const to of ['a.'.repeat(128000),'a.'.repeat(128000)+'@']){
      await transport.sendMail({from:'sender@example.test',to,subject:'Parser regression',text:'Local only'});
    }
    process.stdout.write('parsed');
  `],{encoding:'utf8',timeout:5000,maxBuffer:1024});
  assert.equal(result.error,undefined,'Address parsing exceeded its five-second process budget');
  assert.equal(result.status,0,'Address parsing must not crash the process');
  assert.equal(result.stdout,'parsed');
});
