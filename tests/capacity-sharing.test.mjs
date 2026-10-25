import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPACITY_SHARING_CHOICES,capacitySharingMode,capacitySharingLabel} from '../src/lib/capacity-sharing.js';

test('retired email-only sharing is displayed as private and cannot be chosen again',()=>{
 assert.equal(CAPACITY_SHARING_CHOICES.some(([mode])=>mode==='EXCLUSIVE'),false);
 assert.equal(capacitySharingMode('EXCLUSIVE','OPEN'),'PRIVATE');
 assert.equal(capacitySharingMode('EXCLUSIVE','PRIVATE'),'PRIVATE');
 assert.equal(capacitySharingLabel('EXCLUSIVE'),'Private network');
});
