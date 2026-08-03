import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root=process.cwd();
const source=await fs.readFile(path.join(root,'public/icon.svg'),'utf8');
const maskableSource=source.replace('rx="14"','rx="0"');
const outputs=[
  {name:'favicon-32.png',size:32,source},
  {name:'icon-192.png',size:192,source},
  {name:'icon-512.png',size:512,source},
  {name:'icon-maskable-512.png',size:512,source:maskableSource},
  {name:'apple-touch-icon.png',size:180,source:maskableSource}
];

const browser=await chromium.launch({headless:true});
try {
  for(const output of outputs){
    const page=await browser.newPage({viewport:{width:output.size,height:output.size}});
    await page.setContent(`<style>html,body{width:100%;height:100%;margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${output.source}`);
    await page.screenshot({path:path.join(root,'public',output.name),omitBackground:true});
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Generated ${outputs.length} Loadgistic brand icons.`);
