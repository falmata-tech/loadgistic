const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Temporary shared pure-domain source while installs retain separate lockfiles.
// No parent workspace or other application directory is watched.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../../src/lib')];
if (process.env.LOADGISTIC_WEB_PREVIEW === '1') {
 const {localPreviewProxy}=require('./scripts/local-preview-proxy.cjs');
 const enhance=config.server?.enhanceMiddleware;
 config.server={...config.server,enhanceMiddleware:(middleware,server)=>localPreviewProxy(enhance?enhance(middleware,server):middleware)};
}
module.exports = config;
