import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {businessDocumentLabel,businessDocumentTypes} from '../src/lib/business-directory/client-contract.js';

const newMessages=[
 'Business results pages','Searching…','Business license','Business address',
 'Refresh documents','Document submitted for review.',
 'Choose a supported file smaller than 4 MB.',
 'Could not confirm submission. Refresh documents before trying again.',
 'Document type','Choose file','JPG, PNG, WebP or PDF','Up to 4 MB',
 'Send for review','Submit a document','Awaiting review','Not approved',
 'Open an authorized Transport Provider or business workspace to continue.',
 'Check the information and try again.',
 'Add the account manager’s first name in Account details before submitting their National ID.',
 'The account details changed. Submit a new document for the current details.',
 'This document is already awaiting review or has a current review.',
 'Choose a valid document to submit.','Choose one of the business documents shown.',
 'Choose a file smaller than 4 MB.','Choose a valid JPG, PNG, WebP or PDF document.'
];
const directoryMessages=[
 'Shared with','Find businesses','Business name, manager or @handle',
 'Account manager','Account manager National ID','Business documents',
 'Manage documents','No businesses match this search.',
 'Could not load business details. Please try again.',
 'Account details changed','More information requested','Expires on (optional)'
];

test('business directory and document actions have native-language copy on web and Expo',()=>{
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

test('new web accessibility labels pass through the translation boundary',()=>{
 const directory=readFileSync(new URL('../src/components/business-directory.tsx',import.meta.url),'utf8');
 const documents=readFileSync(new URL('../src/components/business-documents.tsx',import.meta.url),'utf8');
 for(const label of ['Clear search','Business results pages','Network']){
  assert.match(directory,new RegExp(`<Localized as="(?:button|nav)" copy=\\{\\['aria-label'\\]\\}[^>]*aria-label="${label}"`));
 }
 assert.match(documents,/<Localized as="button" copy=\{\['aria-label'\]\}[^>]*aria-label="Close"/);
});
