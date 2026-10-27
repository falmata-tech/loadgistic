import type {Locator,Page} from 'playwright-core';
import {expect} from './browser-test';

/** Check the actual phone layout, including the driving owner's three-tab row. */
export async function expectBalancedProviderHomeTabs(page:Page,row:Locator,role:'link'|'tab',labels:string[]){
 const original=page.viewportSize(),url=page.url();
 try{
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   await expect(row).toBeVisible();
   const controls=row.getByRole(role);
   await expect(controls).toHaveText(labels);
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
   const layout=await row.evaluate((element,controlRole)=>{
    const box=element.getBoundingClientRect(),style=getComputedStyle(element);
    const parent=element.parentElement!,parentBox=parent.getBoundingClientRect(),parentStyle=getComputedStyle(parent);
    const availableLeft=parentBox.left+parseFloat(parentStyle.borderLeftWidth)+parseFloat(parentStyle.paddingLeft);
    const availableRight=parentBox.right-parseFloat(parentStyle.borderRightWidth)-parseFloat(parentStyle.paddingRight);
    const left=box.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft);
    const right=box.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight);
    const controls=Array.from(element.querySelectorAll(controlRole==='link'?'a':'[role="tab"]')).map(control=>{
     const bounds=control.getBoundingClientRect(),rects:DOMRect[]=[];
     const walker=document.createTreeWalker(control,NodeFilter.SHOW_TEXT);
     for(let node=walker.nextNode();node;node=walker.nextNode()){
      if(!node.textContent?.trim())continue;
      const range=document.createRange();range.selectNodeContents(node);rects.push(...range.getClientRects());
     }
     const textLeft=Math.min(...rects.map(rect=>rect.left)),textRight=Math.max(...rects.map(rect=>rect.right));
     return {left:bounds.left,right:bounds.right,top:bounds.top,width:bounds.width,height:bounds.height,textLeft,textRight,textCenter:(textLeft+textRight)/2,center:(bounds.left+bounds.right)/2};
    });
    return {left,right,rowLeft:box.left,rowRight:box.right,availableLeft,availableRight,controls,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};
   },role);
   expect(layout.controls).toHaveLength(labels.length);
   expect(layout.scrollWidth,`${width}px page overflow`).toBeLessThanOrEqual(width);
   expect(Math.abs(layout.rowLeft-layout.availableLeft),`${width}px available row start`).toBeLessThanOrEqual(1);
   expect(Math.abs(layout.rowRight-layout.availableRight),`${width}px available row end`).toBeLessThanOrEqual(1);
   expect(Math.abs(layout.controls[0].left-layout.left),`${width}px row left edge`).toBeLessThanOrEqual(1);
   expect(Math.abs(layout.controls.at(-1)!.right-layout.right),`${width}px row right edge`).toBeLessThanOrEqual(1);
   const widths=layout.controls.map(control=>control.width);
   expect(Math.max(...widths)-Math.min(...widths),`${width}px equal tab widths`).toBeLessThanOrEqual(1);
   for(const [index,control] of layout.controls.entries()){
    expect(control.height,`${width}px ${labels[index]} touch height`).toBeGreaterThanOrEqual(44);
    expect(control.top,`${width}px one tab row`).toBeCloseTo(layout.controls[0].top,0);
    expect(control.left).toBeGreaterThanOrEqual(0);expect(control.right).toBeLessThanOrEqual(layout.viewport);
    expect(Number.isFinite(control.textCenter),`${width}px visible label`).toBe(true);
    expect(control.textLeft,`${width}px unclipped label start`).toBeGreaterThanOrEqual(control.left);
    expect(control.textRight,`${width}px unclipped label end`).toBeLessThanOrEqual(control.right);
    expect(Math.abs(control.textCenter-control.center),`${width}px centered label`).toBeLessThanOrEqual(2);
   }
   await expect(page).toHaveURL(url);
  }
 }finally{if(original)await page.setViewportSize(original);}
}

/** The location fact and translated vehicle action need separate phone rows. */
export async function expectFleetPhoneRows(page:Page,rows:Locator){
 const original=page.viewportSize();
 try{
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   await expect(rows.first()).toBeVisible();
   const layout=await rows.evaluateAll(elements=>elements.map(element=>{
    const location=element.querySelector(':scope > div:nth-of-type(2)')!,action=element.querySelector('a[href^="/app/fleet/"]')!;
    const fact=location.getBoundingClientRect(),button=action.getBoundingClientRect(),card=element.getBoundingClientRect(),style=getComputedStyle(element);
    return {locationBottom:fact.bottom,actionTop:button.top,height:button.height,left:button.left,right:button.right,contentLeft:card.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),contentRight:card.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight),gap:parseFloat(style.rowGap),overflow:document.documentElement.scrollWidth>innerWidth};
   }));
   expect(layout.length).toBeGreaterThan(0);
   for(const row of layout){
    expect(row.actionTop,`${width}px action below location fact`).toBeGreaterThanOrEqual(row.locationBottom+Math.max(1,row.gap)-1);
    expect(row.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(row.left-row.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(row.right-row.contentRight)).toBeLessThanOrEqual(1);
    expect(row.overflow).toBe(false);
   }
  }
 }finally{if(original)await page.setViewportSize(original);}
}
