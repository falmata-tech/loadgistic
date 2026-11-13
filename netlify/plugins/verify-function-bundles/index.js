const {spawnSync}=require('node:child_process');
const path=require('node:path');

module.exports={onPostBuild({constants,utils}){
 const result=spawnSync('python3',[path.resolve(__dirname,'../../../scripts/verify-netlify-function-bundles.py'),constants.FUNCTIONS_DIST,process.cwd()],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:32*1024,timeout:120000
 });
 let value;try{value=JSON.parse(result.stdout||'');}catch{}
 if(result.error||result.signal||result.status!==0||value?.passed!==true){
  const codes=new Set(['BUNDLE_COUNT_INVALID','HANDLER_MANIFEST_MISSING','HANDLER_BUNDLER_CHANGED','BUNDLE_FILE_INVALID','ENTRY_COUNT_INVALID','BUNDLE_EXPANSION_INVALID','DUPLICATE_ENTRY','UNSAFE_ENTRY_PATH','PRIVATE_ENTRY','UNSAFE_SYMLINK','ZIP_INTEGRITY_FAILED','HANDLER_ENTRY_MISSING','HANDLER_IMPORT_MISSING','RUNTIME_FILE_MISSING','RUNTIME_FILE_TOO_LARGE','RUNTIME_LAYOUT_INVALID','TRACING_ROOT_MISMATCH','HANDLER_MODULE_MISSING','SERVER_BUNDLE_MISSING','BUNDLE_INSPECTION_FAILED']);
  utils.build.failBuild('NETLIFY_FUNCTION_BUNDLE_CHECK_FAILED '+(codes.has(value?.code)?value.code:'VERIFIER_UNAVAILABLE'));
  return;
 }
 console.log('NETLIFY_FUNCTION_BUNDLES_VERIFIED '+JSON.stringify(value));
}};
