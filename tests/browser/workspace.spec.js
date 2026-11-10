import {test,expect} from '@playwright/test';
const user={id:'11111111-1111-4111-8111-111111111111',email:'author@example.test',aud:'authenticated',role:'authenticated'};
const doc={title:'Synthetic review for testing',snapshot:'test',url:'https://example.test/paper?id=1',reviews:[{reviewer:'TEST',id:'note',date:'2026-11-10',scores:[],sections:[{key:'weaknesses',title:'Weaknesses',items:[{id:'TEST-W1',number:1,depth:0,text:'Synthetic weakness',translation:'虚构译文',interpretation:'虚构解读'}]}]}]};
async function backend(page,{member=true}={}){
 let rows={},comments=[];const calls=[];
 await page.route('https://example.supabase.co/**',async route=>{
  const request=route.request(),url=request.url();
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});return;}
  let status=200,data;
  if(url.includes('/auth/v1/token'))data={access_token:'test-token',token_type:'bearer',expires_in:3600,refresh_token:'test-refresh',user};
  else if(url.includes('/auth/v1/user'))data=user;
  else if(url.includes('/rest/v1/rpc/workspace_api')){
   const args=request.postDataJSON();calls.push(args);
   if(!member){status=403;data={code:'PT403',message:'你没有此工作台的访问权限'};}
   else if(args.path==='/api/document')data=doc;
   else if(args.path.startsWith('/api/comments')){
    if(args.method==='GET')data=comments;
    else if(args.method==='POST'){data={...args.payload,id:'comment1',created_at:new Date().toISOString(),updated_at:'v1',replies:[]};comments.push(data);}
    else if(args.method==='PATCH'){comments[0].replies.push({text:args.payload.reply,created_at:new Date().toISOString()});comments[0].updated_at='v2';data=comments[0];}
    else{comments=[];data={deleted:true};}
   }
   else if(args.method==='GET')data=rows;
   else{
    const id=args.path.split('/').at(-1),old=rows[id]||{version:0};
    if(args.payload.version!==old.version){status=409;data={code:'PT409',message:'版本已更新，请合并后再保存'};}
    else data=rows[id]={item_id:id,text:args.payload.text,version:old.version+1};
   }
  }else data={};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*'}});
 });
 return {calls,remote(text){rows['TEST-W1']={text,version:(rows['TEST-W1']?.version||0)+1};}};
}
async function login(page){await page.goto('/dist/');await page.getByLabel('邮箱',{exact:true}).fill(user.email);await page.getByLabel('密码',{exact:true}).fill('test-password');await page.getByRole('button',{name:'登录',exact:true}).click();}
test('login gates data, relative asset paths load, saves and remote refresh work',async({page})=>{
 const server=await backend(page);await page.goto('/dist/');await expect(page.getByRole('heading',{name:'登录评审与回复工作台'})).toBeVisible();expect(server.calls.length).toBe(0);
 await login(page);await expect(page.getByText(doc.title,{exact:true})).toBeVisible();
 const reply=page.getByLabel('TEST 1 Weaknesses 最终回复',{exact:true});await reply.fill('My response');await expect(page.getByText('已保存到云端',{exact:true})).toBeVisible();
 server.remote('Another author response');await page.evaluate(()=>window.dispatchEvent(new Event('workspace:refresh')));await expect(reply).toHaveValue('Another author response');
 await reply.fill('Unsaved draft');server.remote('Concurrent response');await page.evaluate(()=>window.dispatchEvent(new Event('workspace:refresh')));await expect(page.getByText('版本冲突，待合并',{exact:true})).toBeVisible();await expect(reply).toHaveValue('Unsaved draft');
 await reply.fill('Merged response');await page.getByRole('button',{name:'保存我已合并的内容'}).click();await expect(page.getByText('已保存到云端',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByLabel('TEST 1 Weaknesses 最终回复',{exact:true})).toHaveValue('Merged response');
 await page.setViewportSize({width:390,height:844});await expect(reply).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('authenticated nonmember cannot see research content',async({page})=>{
 await backend(page,{member:false});await login(page);await expect(page.getByRole('alert')).toContainText('没有此工作台');await expect(page.getByText(doc.title,{exact:true})).toHaveCount(0);
});

test('selection comments can be saved, supplemented and removed through cloud adapter',async({page})=>{
 await backend(page);await login(page);await expect(page.getByText('Synthetic weakness',{exact:true})).toBeVisible();
 await page.getByText('Synthetic weakness',{exact:true}).scrollIntoViewIfNeeded();
 await page.getByText('Synthetic weakness',{exact:true}).evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(range);});
 await page.getByRole('button',{name:'添加批注',exact:true}).click();await page.getByLabel('问题或修改意见',{exact:true}).fill('Please clarify');
 await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'继续批注草稿',exact:true}).click();await expect(page.getByLabel('问题或修改意见',{exact:true})).toHaveValue('Please clarify');await page.getByRole('button',{name:'保存批注',exact:true}).click();
 await page.locator('#panel-toggle').click();await expect(page.locator('.comment-question')).toHaveText('Please clarify');
 await page.getByRole('button',{name:'补充',exact:true}).click();await page.getByLabel('补充说明',{exact:true}).fill('More detail');await page.getByRole('button',{name:'保存补充',exact:true}).click();await expect(page.locator('.reply-text')).toHaveText('More detail');
 await page.getByRole('button',{name:'已解决并删除',exact:true}).click();await expect(page.locator('.comment-card')).toHaveCount(0);
});

test('account change broadcast reloads identity and never autosaves the old account draft as the new user',async({page})=>{
 const server=await backend(page);page.on('dialog',dialog=>dialog.accept());await login(page);
 const reply=page.getByLabel('TEST 1 Weaknesses 最终回复',{exact:true});await reply.fill('Private unsaved draft');
 await page.evaluate(()=>{
  const key='rebuttal-auth:example.supabase.co',session=JSON.parse(localStorage.getItem(key));
  session.user={...session.user,id:'22222222-2222-4222-8222-222222222222',email:'other@example.test'};
  localStorage.setItem(key,JSON.stringify(session));const channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session});channel.close();
 });
 await expect(page.locator('#account')).toHaveText('other@example.test');await expect(reply).toHaveValue('');
 expect(server.calls.filter(c=>c.method==='PUT'&&c.payload.text==='Private unsaved draft'&&c.expected_user==='22222222-2222-4222-8222-222222222222')).toEqual([]);
 expect(await page.evaluate(()=>Object.entries(localStorage).some(([k,v])=>k.startsWith('rebuttal:example.supabase.co:11111111-1111-4111-8111-111111111111:responses:')&&v.includes('Private unsaved draft')))).toBe(true);
});
