import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),path=require('node:path'),file=new URL('../scripts/local-preview-proxy.cjs',import.meta.url);
const original=require('../scripts/local-preview-proxy.cjs');
function proxy(value){
 const calls=[],events={},responseEvents={},output={headersSent:false,writableEnded:false,status:0,headers:{},body:''};
 const upstream={on(name,fn){events[name]=fn;return this;},destroy(){}};
 const module={exports:{}},dependencies={'node:http':{request:(options,reply)=>{calls.push(options);upstream.reply=reply;return upstream;}},'node:fs':{createReadStream:()=>assert.fail('No file read is needed for API proxy tests')},'node:path':path};
 vm.runInNewContext(readFileSync(file,'utf8'),{module,exports:module.exports,__dirname:path.dirname(file.pathname),process:{env:value===undefined?{}:{LOADGISTIC_PREVIEW_BACKEND_PORT:value}},require:name=>dependencies[name]||require(require.resolve(name,{paths:[path.dirname(file.pathname)]})),URLSearchParams});
 const handler=()=>module.exports.localPreviewProxy(()=>{output.next=true;});
 return{calls,events,upstream,output,handler,request(url='/api/mobile/session',method='GET',host='localhost:8084'){
  const request={url,method,headers:{host,cookie:'private-cookie',authorization:'Bearer synthetic-account','x-loadgistic-tracking-grant':'synthetic.grant'},on(){},pipe(){output.piped=true;}};
  const response={get headersSent(){return output.headersSent;},get writableEnded(){return output.writableEnded;},setHeader(){},writeHead(status,headers){output.status=status;output.headers=headers;output.headersSent=true;},end(body){output.body=body;output.writableEnded=true;},on:(name,fn)=>responseEvents[name]=fn};
  handler()(request,response,()=>{output.next=true;});return output;
 }};
}
test('preview defaults to3100 and permits only the two exact loopback backend port values',()=>{
 assert.equal(original.previewBackendPort({}),3100);
 for(const value of['3100','3101'])assert.equal(original.previewBackendPort({LOADGISTIC_PREVIEW_BACKEND_PORT:value}),Number(value));
 for(const value of['','3000','8084','03101','3101 ','http://127.0.0.1:3101','loadgistic.com:443',3101,null]){assert.throws(()=>original.previewBackendPort({LOADGISTIC_PREVIEW_BACKEND_PORT:value}),/LOCAL_PREVIEW_BACKEND_PORT_INVALID/);assert.throws(()=>proxy(value).handler(),/LOCAL_PREVIEW_BACKEND_PORT_INVALID/);}
});
test('both allowed ports keep exact path/method, strip cookies and response cookies, and retain explicit native credentials',()=>{
 for(const value of[undefined,'3100','3101']){
  const p=proxy(value);p.request('/api/tracking/access','POST');assert.equal(p.calls.length,1);const options=p.calls[0],port=value===undefined?3100:Number(value);
  assert.equal(options.hostname,'127.0.0.1');assert.equal(options.port,port);assert.equal(options.headers.host,`127.0.0.1:${port}`);assert.equal(options.path,'/api/tracking/access');assert.equal(options.method,'POST');assert.equal(options.timeout,65000);assert.equal(options.headers.cookie,undefined);assert.equal(options.headers.authorization,'Bearer synthetic-account');assert.equal(options.headers['x-loadgistic-tracking-grant'],'synthetic.grant');
  p.upstream.reply({statusCode:200,headers:{'set-cookie':'private-response-cookie','content-type':'application/json'},pipe(){}});assert.equal(p.output.status,200);assert.equal(p.output.headers['set-cookie'],undefined);assert.equal(p.output.headers['content-type'],'application/json');
 }
});
test('candidate routing still denies foreign hosts and wrong Tracking methods without opening an upstream connection',()=>{
 const remote=proxy('3101');assert.equal(remote.request('/api/mobile/session','GET','foreign.test').status,403);assert.equal(remote.calls.length,0);
 const wrong=proxy('3101');assert.equal(wrong.request('/api/tracking/access','GET').status,400);assert.equal(wrong.calls.length,0);
 const outside=proxy('3101');assert.equal(outside.request('/api/admin/accounts').next,true);assert.equal(outside.calls.length,0);
 const down=proxy('3101');down.request();down.events.error();assert.equal(down.output.status,502);const body=JSON.parse(down.output.body);assert.equal(body.error.code,'LOCAL_BACKEND_UNAVAILABLE');assert.equal(body.error.message,'Start the Loadgistic local server on port 3101.');
});
