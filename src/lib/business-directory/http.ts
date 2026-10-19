import {BusinessDirectoryError} from './domain.js';
import {businessFailure,businessJson} from '../business-workspaces/http';
const messages:Record<string,string>={FORBIDDEN:'Open an authorized Transport Provider or business workspace to continue.',INVALID_BUSINESS_INPUT:'Check the information and try again.',BUSINESS_MANAGER_NAME_REQUIRED:'Add the account manager’s first name in Account details before submitting their National ID.',VERIFICATION_SUBJECT_CHANGED:'The account details changed. Submit a new document for the current details.',VERIFICATION_ALREADY_SUBMITTED:'This document is already awaiting review or has a current review.',VERIFICATION_DOCUMENT_REQUIRED:'Choose a valid document to submit.',INVALID_VERIFICATION_TYPE:'Choose one of the business documents shown.'};
export function directoryFailure(error:unknown):Response {
 const code=error instanceof BusinessDirectoryError?error.code:error instanceof Error?error.message:'';
 if(code==='FILE_TOO_LARGE')return businessJson({error:{code,message:'Choose a file smaller than 4 MB.'}},413);
 if(['MULTIPART_REQUIRED','INVALID_UPLOAD','UNSUPPORTED_FILE_TYPE','FILE_CONTENT_MISMATCH'].includes(code))return businessJson({error:{code:'INVALID_INPUT',message:'Choose a valid JPG, PNG, WebP or PDF document.'}},400);
 if(messages[code])return businessJson({error:{code,message:messages[code]}},code==='FORBIDDEN'?403:code==='INVALID_BUSINESS_INPUT'||code==='INVALID_VERIFICATION_TYPE'||code==='VERIFICATION_DOCUMENT_REQUIRED'?400:409);
 return businessFailure(error);
}
