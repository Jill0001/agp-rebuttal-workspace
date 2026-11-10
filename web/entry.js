import {createClient} from '@supabase/supabase-js';
import {connectClient} from './transport.js';
import {el} from './ui.js';
const url=__SUPABASE_URL__,key=__SUPABASE_KEY__;
const main=document.querySelector('main');
const actions=[...document.querySelectorAll('header nav button')];
function controls(visible){for(const button of actions)button.hidden=!visible;document.querySelector('#resume-draft').hidden=true;}
controls(false);
if(!url||!key){
 main.replaceChildren(el('h1','','工作台尚未配置'),el('p','','请按项目 README 配置 Supabase 后重新部署。'));
}else{
 const client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'rebuttal-auth:'+new URL(url).host}});
 let loaded=false,loadedUser=null;
 async function start(session){
  if(!session){login();return;}
  connectClient(client,session.user.id,new URL(url).host);
  const {error}=await client.rpc('workspace_api',{method:'GET',path:'/api/document',payload:{},expected_user:session.user.id});
  if(error){login(error.message);return;}
  if(loaded){location.reload();return;}
  loaded=true;loadedUser=session.user.id;controls(true);document.querySelector('#account').textContent=session.user.email;
  document.querySelector('#logout').onclick=async()=>{
   if(!confirm('退出登录？未提交的草稿会保留在此浏览器，仅供当前账号恢复。'))return;
   const {error}=await client.auth.signOut();if(error){alert(error.message);return;}location.reload();
  };
  const {boot}=await import('./app.js');await boot();
  setInterval(()=>{if(!document.hidden)window.dispatchEvent(new Event('workspace:refresh'));},10000);
 }
 function login(message=''){
  controls(false);main.replaceChildren(el('h1','','登录评审与回复工作台'),el('p','','使用所有者为你开通的邮箱账号查看评审、编辑回复和添加批注。'));
  const form=el('form','login-form'),email=el('input'),password=el('input'),button=el('button','primary','登录'),error=el('p','login-error',message);
  error.setAttribute('role','alert');email.type='email';email.required=true;email.autocomplete='username';email.id='login-email';
  password.type='password';password.required=true;password.autocomplete='current-password';password.id='login-password';
  const a=el('label','','邮箱'),b=el('label','','密码');a.htmlFor=email.id;b.htmlFor=password.id;
  form.append(a,email,b,password,button,error);main.append(form);
  form.onsubmit=async event=>{event.preventDefault();button.disabled=true;error.textContent='正在登录…';try{
   const {data,error:failure}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
   if(failure)throw failure;password.value='';await start(data.session);
  }catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
 }
 client.auth.onAuthStateChange((event,session)=>{
  if(loaded&&(event==='SIGNED_OUT'||(session&&session.user.id!==loadedUser))){
   // Input handlers already persist drafts under the previous user's namespace.
   // Block further requests immediately, then rebuild for the new identity.
   connectClient(null,'','');loaded=false;controls(false);
   main.replaceChildren(el('p','','登录状态已改变，正在重新加载…'));
   document.querySelector('#reviewer-tabs').replaceChildren();
   document.querySelector('#account').textContent='';
   document.querySelector('#annotations').hidden=true;
   document.querySelector('#comment-composer').hidden=true;
   document.querySelector('#selection-add').hidden=true;
   location.reload();
  }
 });
 client.auth.getSession().then(({data,error})=>error?login(error.message):start(data.session)).catch(e=>login(e.message));
}
