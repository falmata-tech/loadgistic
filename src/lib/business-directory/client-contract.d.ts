import type {BusinessDirectoryPage,BusinessDocumentsView,BusinessDocumentBadge,BusinessDocumentType} from './contracts';
export const businessDocumentTypes:BusinessDocumentType[];
export function businessDocumentLabel(type:string):string;
export function businessDocumentState(badge:BusinessDocumentBadge):string;
export function parseBusinessDirectoryPage(value:unknown):BusinessDirectoryPage;
export function parseBusinessDocuments(value:unknown,workspaceId:string,canManage:boolean):BusinessDocumentsView;
