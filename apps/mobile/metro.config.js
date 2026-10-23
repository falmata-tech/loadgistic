const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Temporary shared pure-domain source while installs retain separate lockfiles.
// No parent workspace or other application directory is watched.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../../src/lib')];
// Shared validation uses the mobile app's pinned runtime dependency. Do not
// expand module lookup to another application's install or the parent tree.
config.resolver.extraNodeModules = {
 ...config.resolver.extraNodeModules,
 zod: path.dirname(require.resolve('zod/package.json', { paths: [__dirname] })),
};
if (process.env.LOADGISTIC_WEB_PREVIEW === '1') {
 const {localPreviewProxy}=require('./scripts/local-preview-proxy.cjs');
 const enhance=config.server?.enhanceMiddleware;
 config.server={...config.server,enhanceMiddleware:(middleware,server)=>localPreviewProxy(enhance?enhance(middleware,server):middleware)};
}
module.exports = config;
