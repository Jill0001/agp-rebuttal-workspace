import test from 'node:test';
import assert from 'node:assert/strict';
import {connectClient,request,draftPrefix} from '../web/transport.js';
import {Responses} from '../web/responses.js';
class Storage{constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i];}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,v);}removeItem(k){this.data.delete(k);}}
globalThis.localStorage=new Storage();globalThis.sessionStorage=new Storage();globalThis.window={addEventListener(){}};globalThis.document={addEventListener(){},hidden:false};
function state(text,version){return {id:'x',text,version,dirty:false,busy:false,input:{value:text},status:{dataset:{}},retry:{},conflictBox:{},diskText:{}};}
test('RPC reports version conflict as 409 for merge UI',async()=>{
 connectClient({rpc:async(name,args)=>{assert.equal(name,'workspace_api');assert.equal(args.payload.version,2);return {error:{code:'PT409',message:'版本冲突'}};}},'a','p');
 await assert.rejects(request('/api/responses/x',{method:'PUT',body:JSON.stringify({text:'draft',version:2})}),e=>e.status===409);
});
test('recovery drafts stay isolated across accounts and windows',()=>{
 localStorage.data.clear();sessionStorage=new Storage();connectClient({},'a','p');const a=new Responses({},()=>{});a.stash({...state('private A',0),dirty:true});
 sessionStorage=new Storage();const otherTab=new Responses({},()=>{});otherTab.stash({...state('draft B',0),dirty:true});otherTab.stash(state('saved',1));assert.equal(a.draft('x').text,'private A');
 connectClient({},'b','p');const b=new Responses({},()=>{});assert.equal(b.draft('x'),null);assert.notEqual(b.key,a.key);
});
test('background refresh preserves dirty draft and exposes other version for merge',async()=>{
 connectClient({rpc:async()=>({data:{x:{text:'remote',version:2}}})},'a','p');const r=new Responses({},()=>{}),s={...state('mine',1),dirty:true};r.states.set('x',s);await r.refresh();
 assert.equal(s.text,'mine');assert.equal(s.input.value,'mine');assert.equal(s.conflict,true);assert.equal(s.diskText.textContent,'remote');assert.equal(s.mergeVersion,2);
});
test('slow refresh cannot replace confirmed newer save or its recovery metadata',async()=>{
 let finish;connectClient({rpc:()=>new Promise(resolve=>finish=resolve)},'a','p');const r=new Responses({},()=>{}),s=state('old',1);r.states.set('x',s);const pending=r.refresh();
 s.version=2;s.text='new';s.input.value='new';r.saved.x={text:'new',version:2};finish({data:{x:{text:'old',version:1}}});await pending;
 assert.equal(s.text,'new');assert.equal(r.saved.x.version,2);
});
