// CI-only observer. Save the checked-in route template, never the requested URL.
'use strict';
if (process.env.GITHUB_ACTIONS === 'true' && process.env.LOADGISTIC_WORKFLOW_AUDIT === '1') {
  const fs = require('node:fs');
  const path = require('node:path');
  const {channel} = require('node:diagnostics_channel');
  const root = path.resolve(__dirname, '../..');
  const out = path.join(root, '.local/workflow-coverage');
  fs.mkdirSync(out, {recursive: true});
  function routes(dir) {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(file => {
      if (file.isDirectory()) return routes(path.join(dir, file.name));
      if (!/^(page|route)\.(tsx?|jsx?)$/.test(file.name)) return [];
      const route = '/' + path.relative(path.join(root, 'src/app'), dir).split(path.sep).filter(Boolean).join('/');
      const segments = route.split('/').map(segment => {
        if (/^\[\.\.\./.test(segment)) return '.+';
        if (segment.startsWith('[')) return '[^/]+';
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
      return [{route, pattern: new RegExp('^'+segments.join('/')+'/?$'), weight: (route.match(/\[/g)||[]).length}];
    });
  }
  const registered = routes(path.join(root, 'src/app')).sort((a,b) => a.weight-b.weight);
  channel('http.server.request.start').subscribe(({request, response}) => {
    if (request.socket.localPort !== 3100 || !['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(request.method)) return;
    const pathname = (request.url || '').split('?',1)[0];
    if (!pathname.startsWith('/') || pathname === '/favicon.ico' || pathname.startsWith('/_next/') || /\.[a-z0-9]{2,5}$/i.test(pathname)) return;
    const match = registered.find(r => r.pattern.test(pathname));
    if (!match || match.route === '/[publicHandle]' && !/^\/(?:@|%40)/i.test(pathname)) return;
    const start = performance.now(), method = request.method;
    response.once('finish', () => {
      fs.appendFileSync(path.join(out,'requests.ndjson'), JSON.stringify([match.route,method,response.statusCode,Math.round(performance.now()-start)])+'\n');
    });
  });
}
