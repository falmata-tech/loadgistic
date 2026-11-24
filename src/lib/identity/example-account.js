/** Use only metadata supplied by the server's verified Auth identity. */
export function isExampleAccountMetadata(appMetadata){
  const source=appMetadata?.fixture_source;
  return source==='loadgistic'||source==='loadgistic-production-pilot-v1';
}
