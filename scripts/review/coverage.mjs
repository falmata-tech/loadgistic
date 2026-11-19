import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const dir='.local/workflow-coverage', mode=process.argv[2];
if(process.env.GITHUB_ACTIONS!=='true'||!['before','after'].includes(mode))throw Error('DISPOSABLE_CI_REQUIRED');
fs.mkdirSync(dir,{recursive:true});
const sql="select coalesce(json_object_agg(schemaname||'.'||relname, array[coalesce(seq_scan,0)+coalesce(idx_scan,0),n_tup_ins,n_tup_upd,n_tup_del]),'{}') from pg_stat_user_tables where schemaname in ('public','auth','storage');";
const tables=JSON.parse(execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-XAt','-d','postgres','-U','postgres','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',timeout:25000}));
if(mode==='before')fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(tables));
else{
 const baseline=JSON.parse(fs.readFileSync(path.join(dir,'before.json'),'utf8')),counts={};
 for(const [name,stats] of Object.entries(tables)) counts[name]=stats.map((n,i)=>n-(baseline[name]?.[i]??0));
 const rows=fs.readFileSync(path.join(dir,'requests.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
 const requests={};
 for(const [route,method,status,ms] of rows){
  const key=method+' '+route, bucket=requests[key]??={statuses:{},ms:[]};
  bucket.statuses[status]=(bucket.statuses[status]||0)+1;bucket.ms.push(ms);
 }
 for(const bucket of Object.values(requests)){bucket.ms.sort((a,b)=>a-b);bucket.count=bucket.ms.length;bucket.medianMs=bucket.ms[Math.floor((bucket.count-1)/2)];bucket.p95Ms=bucket.ms[Math.ceil(bucket.count*.95)-1];delete bucket.ms;}
 if(!rows.length)throw Error('HTTP_EVIDENCE_EMPTY');
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({requests,tables:counts},null,2));
}
