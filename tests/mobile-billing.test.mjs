import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const source = readFileSync('src/lib/mobile/billing-contract.ts', 'utf8').replace("import { z } from 'zod';", '').replaceAll('export ', '');
const { paymentCommand, billingSummary } = new Function('z', ts.transpile(source) + ';return {paymentCommand,billingSummary};')(z);
test('payment command has bounded ETB precision and rejects client-selected account/subscription', () => {
 for (const amountEtb of [1, 0.01, 125.25, 100000000]) assert.equal(paymentCommand.safeParse({ amountEtb, reference: 'transfer' }).success, true);
 for (const amountEtb of [0, -1, 0.001, NaN, Infinity, 100000001]) assert.equal(paymentCommand.safeParse({ amountEtb }).success, false);
 for (const extra of [{ actorId: 'other' }, { subscriptionId: 'other' }, { storagePath: 'private' }]) assert.equal(paymentCommand.safeParse({ amountEtb: 100, ...extra }).success, false);
});
test('billing excludes private references and blocks free or sponsored payment entry while showing limited-account history', () => {
 const input = { subscription: { id: 'subscription', plan_name: 'Fleet', organization_id: 'secret' }, proofPage: { items: [{ id: 'proof', amount_minor: 500, reference: 'transfer', storage_path: 'secret', status: 'PENDING', has_file: true }], page: 2, pageCount: 3 } };
 for (const status of ['FREE_ACCESS', 'SPONSORED']) assert.equal(billingSummary(input, { status }).canSubmit, false);
 const limited = billingSummary(input, { status: 'EXPIRED_UNPAID', granted: false }); assert.equal(limited.canSubmit, false); assert.equal(limited.granted, false); assert.equal(limited.page, 2); assert.equal(limited.proofs[0].hasFile, true); assert.equal(JSON.stringify(limited).includes('secret'), false);
 assert.equal(billingSummary({}, { status: 'ACTIVE' }).canSubmit, false);
});
