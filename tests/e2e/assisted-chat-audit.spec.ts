import {test,expect} from '@playwright/test';

test('chat start, attachment reply, end and restart have no false failure',async({page}:{page:any})=>{
  let conversation:any=null;
  let posts=0;
  await page.route('**/api/guest-support**',async(route:any)=>{
    const request=route.request();
    if(request.method()==='POST'){
      posts+=1;
      if(request.url().endsWith('/end'))conversation={...conversation,status:'CLOSED'};
      else if(request.url().endsWith('/messages'))conversation={...conversation,messages:[...conversation.messages,{id:'reply',sender_kind:'GUEST',body:'Please see the file',created_at:new Date().toISOString(),attachment_id:'image',attachment_name:'cargo.png'}]};
      else conversation={id:`chat-${posts}`,status:'OPEN',messages:[{id:'first',sender_kind:'GUEST',body:'Need a mini truck',created_at:new Date().toISOString()}]};
      return route.fulfill({json:{ok:true}});
    }
    return route.fulfill({json:{conversation,presence:{available:true,availableTeamMembers:1}}});
  });
  await page.goto('/about');
  await page.getByRole('button',{name:'Ask Loadgistic',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Email',{exact:true}).fill('synthetic-chat@example.test');
  await dialog.getByLabel('Callback phone').fill('+251911000000');
  await dialog.getByLabel('What do you need?').fill('Need a mini truck');
  await dialog.getByRole('button',{name:'Start chat',exact:true}).click();
  await expect(dialog.getByText('Need a mini truck',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByLabel('Reply',{exact:true}).fill('Please see the file');
  await dialog.locator('input[type=file]').setInputFiles({name:'cargo.png',mimeType:'image/png',buffer:Buffer.from('mock upload: backend not exercised')});
  await dialog.getByRole('button',{name:'Send reply'}).click();
  await expect(dialog.getByLabel('Reply',{exact:true})).toHaveValue('');
  await expect(dialog.getByRole('link',{name:'cargo.png'})).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button',{name:'End chat',exact:true}).click();
  await dialog.getByRole('button',{name:'Confirm end',exact:true}).click();
  await dialog.getByRole('button',{name:'Start a new chat'}).click();
  await expect(dialog.getByLabel('What do you need?')).toBeVisible();
  expect(posts).toBe(3);
});

test('failed chat submission retains text and blocks concurrent duplicate actions',async({page}:{page:any})=>{
  let posts=0;
  let release:()=>void=()=>{};
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/guest-support**',async(route:any)=>{
    if(route.request().method()==='POST'){
      posts+=1;await pending;
      return route.fulfill({status:400,json:{error:'Please check your phone number.'}});
    }
    return route.fulfill({json:{conversation:null,presence:{available:false,availableTeamMembers:0}}});
  });
  await page.goto('/about');
  await page.getByRole('button',{name:'Ask Loadgistic',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Email',{exact:true}).fill('synthetic-chat@example.test');
  await dialog.getByLabel('Callback phone').fill('+251911000000');
  await dialog.getByLabel('What do you need?').fill('Keep my message');
  await dialog.getByRole('button',{name:'Start chat',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Start chat',exact:true})).toBeDisabled();
  await dialog.locator('form').evaluate((form:HTMLFormElement)=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  release();
  await expect(dialog.getByRole('alert')).toHaveText('Please check your phone number.');
  await expect(dialog.getByLabel('What do you need?')).toHaveValue('Keep my message');
  expect(posts).toBe(1);
});

test('saved messages distinguish a refresh failure from a submission failure',async({page}:{page:any})=>{
  let saved=false;
  await page.route('**/api/guest-support**',async(route:any)=>{
    if(route.request().method()==='POST'){saved=true;return route.fulfill({json:{ok:true}});}
    if(saved)return route.fulfill({status:503,json:{error:'Unavailable'}});
    return route.fulfill({json:{conversation:{id:'existing',status:'OPEN',messages:[]},presence:{available:true,availableTeamMembers:1}}});
  });
  await page.goto('/about');
  await page.getByRole('button',{name:'Ask Loadgistic',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Reply',{exact:true}).fill('Saved message');
  await dialog.getByRole('button',{name:'Send reply'}).click();
  await expect(dialog.getByLabel('Reply',{exact:true})).toHaveValue('');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('status')).toContainText('Saved.');
});
