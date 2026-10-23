import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {businessDocumentLabel,businessDocumentTypes} from '../src/lib/business-directory/client-contract.js';

const newMessages=[
 'Shipper / broker result pages','Searching…','Business license','Business address',
 'Refresh documents','Document submitted for review.',
 'Choose a supported file smaller than 4 MB.',
 'Could not confirm submission. Refresh documents before trying again.',
 'Document type','Choose file','JPG, PNG, WebP or PDF','Up to 4 MB',
 'Send for review','Submit a document','Awaiting review','Not approved',
 'Open an authorized Transport Provider or Shipper / broker workspace to continue.',
 'Check the information and try again.',
 'Add the account manager’s first name in Account details before submitting their National ID.',
 'The account details changed. Submit a new document for the current details.',
 'This document is already awaiting review or has a current review.',
 'Choose a valid document to submit.','Choose one of the workspace documents shown.',
 'Choose a file smaller than 4 MB.','Choose a valid JPG, PNG, WebP or PDF document.'
];
const directoryMessages=[
 'Shared with','Shippers & brokers','Find shippers or brokers','Account name, manager or @handle',
 'Account manager','Account manager National ID','Shipper / broker documents',
 'Shipper / broker account','Shipper / broker workspace','Create a shipper / broker workspace',
 'Set up this workspace','Shipper / broker access','Workspace details','Leave workspace','Workspace admin','Shipper / broker','Shipper / broker result pages','Contact name',
 'Could not load workspace details. Please try again.','This workspace changed. Refresh before saving.',
 'That workspace handle is already in use.','Transfer ownership or archive the workspace before leaving.',
 'Choose one of the workspace documents shown.',
 'Archive workspace','Edit workspace details','Which best describes your work?',
 'This member will lose access to this workspace.',
 "Capacity and Tracking access apply only to this workspace. Vehicle location needs the shipment owner's separate permission.",
 'This teammate will become the workspace owner. You will remain a workspace admin.',
 'Transfer ownership or archive your workspace before closing your account.',
 'This workspace will stop receiving shared capacity and shipments. Its team will lose workspace access. Existing history is retained.',
 "You will lose access to this workspace's shared capacity and shipments.",
 'Workspace access is inactive.','Remove from workspace','Add to this workspace',
 'Workspaces','Receiver workspace','Workspace documents','Workspace','Transport Provider documents',
 'Open My workspace to create or join a shipper or broker workspace.',
 'Your team access does not include that page. Contact your workspace admin.',
 'Open an authorized Transport Provider or Shipper / broker workspace to continue.',
 'When a shipment owner shares tracking with your workspace, it will appear here.',
 'Shared with your workspace',
 'Shippers and brokers who save this fleet as a partner will appear here.',
 'Your routes and partner areas.',
 'The Shipper / broker must add the receiver name and phone first.',
 'Open an authorized Transport Provider or Shipper / broker workspace to continue.',
 'Share vehicle availability with shippers and brokers, and keep customers informed through private Tracking.',
 'Search shippers or brokers','No shippers or brokers match this search.',
 'Review is optional. Transport Providers can find and share Capacity with your account without documents. Approved documents add trust badges. Fees are paid offline.',
 'Share privately with shippers and brokers you work with. Each email gets access only to the vehicles you choose.',
 'Could not load workspace details. Please try again.',
 'Account details changed','More information requested','Expires on (optional)'
];

test('shipper/broker directory, document and sharing tasks have native-language copy on web and Expo',()=>{
 const labels=[...new Set([...newMessages,...directoryMessages,...businessDocumentTypes.map(businessDocumentLabel)])];
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  for(const label of labels){
   assert.ok(typeof messages[label]==='string'&&messages[label].trim(),`${locale}: ${label}`);
   assert.notEqual(messages[label],label,`${locale}: ${label}`);
   assert.doesNotMatch(messages[label],/\b(?:BUSINESS_WORKSPACE|BUSINESS_LICENSE|BUSINESS_ADDRESS|IDENTITY|MORE_INFO|PENDING)\b/,`${locale}: ${label}`);
  }
 }
});

test('mobile document summaries use workspace and Transport Provider language in all shipped locales',()=>{
 const workflow=readFileSync(new URL('../apps/mobile/src/localization/workflow-messages.ts',import.meta.url),'utf8');
 assert.match(workflow,/Each review belongs to the workspace, driver or vehicle shown below\./);
 assert.doesNotMatch(workflow,/Each review belongs to the company, driver or truck/);
});

test('new web accessibility labels pass through the translation boundary',()=>{
 const directory=readFileSync(new URL('../src/components/business-directory.tsx',import.meta.url),'utf8');
 const documents=readFileSync(new URL('../src/components/business-documents.tsx',import.meta.url),'utf8');
 for(const label of ['Clear search','Shipper / broker result pages','Network']){
  assert.match(directory,new RegExp(`<Localized as="(?:button|nav)" copy=\\{\\['aria-label'\\]\\}[^>]*aria-label="${label}"`));
 }
 assert.match(documents,/<Localized as="button" copy=\{\['aria-label'\]\}[^>]*aria-label="Close"/);
});
