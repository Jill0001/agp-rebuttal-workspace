import {el,api,toast} from './ui.js';
import {draftPrefix} from './transport.js';
export class Responses {
 constructor(saved,onChange){this.key=draftPrefix('responses');this.saved=saved;this.states=new Map();this.onChange=onChange;this.refreshSequence=0;
  try{this.owner=sessionStorage.getItem(this.key+'owner')||crypto.randomUUID();sessionStorage.setItem(this.key+'owner',this.owner);}catch{this.owner=crypto.randomUUID();}
  window.addEventListener('beforeunload',e=>{if([...this.states.values()].some(s=>s.dirty||s.busy)){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{for(const s of this.states.values())if(s.dirty&&!s.conflict)this.persist(s);});
  window.addEventListener('focus',()=>this.refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh();else for(const s of this.states.values())if(s.dirty&&!s.conflict)this.persist(s);});
 }
 draft(id){try{return JSON.parse(localStorage.getItem(this.key+id+':'+this.owner));}catch{return null;}}
 stash(s){try{if(s.dirty)localStorage.setItem(this.key+s.id+':'+this.owner,JSON.stringify({text:s.text,version:s.version,updated:Date.now()}));else localStorage.removeItem(this.key+s.id+':'+this.owner);}catch{toast('浏览器无法保存恢复草稿，请保持页面打开直到保存成功。');}}
 attach(item,reviewer,section,kind='reply'){
  const isIdeas=kind==='ideas',title=isIdeas?'人工撰写回复思路':'最终回复';
  if(isIdeas)item={...item,id:item.id+'--ideas'};
  const disk=this.saved[item.id]||{text:'',version:0},draft=this.draft(item.id);
  const valid=draft&&typeof draft.text==='string'&&Number.isInteger(draft.version);
  const s={id:item.id,kind,text:valid?draft.text:disk.text,version:disk.version,dirty:!!valid&&draft.text!==disk.text,busy:false,conflict:false,timer:null};
  if(s.dirty&&draft.version!==disk.version){s.conflict=true;s.version=draft.version;s.mergeVersion=disk.version;}
  this.states.set(item.id,s);
  const wrap=el('div','response-editor'),top=el('div','editor-top'),label=el('label','',title),status=el('span','save-state');status.setAttribute('role','status');
  const input=el('textarea','response-input');input.id='response-'+item.id;input.setAttribute('aria-label',reviewer+' '+item.number+' '+section+' '+title);label.htmlFor=input.id;input.rows=3;input.placeholder=isIdeas?'写下你想回应的要点、依据和表达方向…':'在这里撰写和修改最终回复…';input.value=s.text;input.spellcheck=false;
  const retry=el('button','retry','重试保存');retry.type='button';retry.hidden=true;
  const conflict=el('div','conflict');conflict.hidden=true;conflict.append(el('p','','此条内容已在其他合作者或窗口更新。你的草稿已保留，请对照下方版本在编辑框中合并。'));
  const diskText=el('pre','disk-version',disk.text||'（云端版本为空）');diskText.dataset.anchor=item.id+'-disk';diskText.dataset.section=section;diskText.dataset.title=reviewer+' '+item.number+' 云端'+title;
  const merged=el('button','','保存我已合并的内容');merged.type='button';conflict.append(diskText,merged);
  top.append(label,status,retry);wrap.append(top,input,conflict);wrap.dataset.editorKind=kind;Object.assign(s,{status,input,retry,conflictBox:conflict,diskText});
  input.oninput=()=>{s.text=input.value;s.dirty=true;s.error='';this.stash(s);this.display(s);this.onChange();clearTimeout(s.timer);if(!s.conflict)s.timer=setTimeout(()=>this.persist(s),650);};
  input.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();this.persist(s);}});
  input.addEventListener('blur',()=>{if(s.dirty&&!s.conflict)this.persist(s);});retry.onclick=()=>this.persist(s);
  merged.onclick=()=>{s.version=s.mergeVersion??s.version;s.conflict=false;s.conflictBox.hidden=true;this.stash(s);this.persist(s);};
  this.recoveries(s,wrap);this.display(s);if(s.dirty&&!s.conflict)s.timer=setTimeout(()=>this.persist(s),650);return wrap;
 }
 recoveries(s,wrap){
  const box=el('details','recovery-list');box.append(el('summary','','其他窗口保留的草稿'));
  let found=false;
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(this.key+s.id+':')||key===this.key+s.id+':'+this.owner)continue;let d;try{d=JSON.parse(localStorage.getItem(key));}catch{continue;}if(typeof d?.text!=='string'||d.text===s.text)continue;
   found=true;const row=el('div','recovery-draft'),text=el('pre','disk-version',d.text),restore=el('button','','载入此草稿');restore.type='button';
   restore.onclick=()=>{s.text=d.text;s.input.value=d.text;s.dirty=true;s.error='';s.conflict=true;s.mergeVersion=this.saved[s.id]?.version??s.version;s.diskText.textContent=this.saved[s.id]?.text||'（云端版本为空）';this.stash(s);this.display(s);this.onChange();};row.append(text,restore);box.append(row);
  }}catch{toast('无法读取其他窗口的恢复草稿。');}if(found)wrap.append(box);
 }
 display(s){s.status.textContent=s.conflict?'版本冲突，待合并':s.busy?'保存中…':s.error?'保存失败，草稿已保留':s.dirty?'等待保存…':s.version?'已保存到云端':'尚未填写';s.status.dataset.state=s.conflict||s.error?'error':s.dirty||s.busy?'pending':'saved';s.retry.hidden=!s.error||s.conflict;s.conflictBox.hidden=!s.conflict;}
 async persist(s){
  clearTimeout(s.timer);if(!s.dirty||s.busy||s.conflict)return;
  if(Array.from(s.text).length>50000){s.error='回复最多50000字符';this.display(s);s.status.textContent=s.error;return;}
  const sent=s.text;s.busy=true;s.error='';this.display(s);
  try{const row=await api('/api/responses/'+encodeURIComponent(s.id),{method:'PUT',body:JSON.stringify({text:sent,version:s.version})});s.version=row.version;this.saved[s.id]=row;s.dirty=s.text!==sent;this.stash(s);}
  catch(e){s.error=e.message;if(e.status===409){s.conflict=true;try{const disk=(await api('/api/responses'))[s.id]||{text:'',version:0};s.mergeVersion=disk.version;s.diskText.textContent=disk.text||'（云端版本为空）';}catch{ s.conflict=false; }}toast(e.message);}
  finally{s.busy=false;this.display(s);this.onChange();if(s.dirty&&!s.error&&!s.conflict)s.timer=setTimeout(()=>this.persist(s),100);}
 }
 async refresh(){
  const sequence=++this.refreshSequence;try{const saved=await api('/api/responses');if(sequence!==this.refreshSequence)return;for(const s of this.states.values()){const d=saved[s.id]||{text:'',version:0};if(s.busy||s.conflict||d.version<=s.version)continue;if(s.dirty){s.conflict=true;s.diskText.textContent=d.text||'（云端版本为空）';s.mergeVersion=d.version;}else{s.text=d.text;s.version=d.version;s.input.value=d.text;}this.display(s);}for(const [id,row] of Object.entries(saved)){if(row.version>(this.saved[id]?.version??-1))this.saved[id]=row;}this.onChange();}catch(e){toast('读取回复失败，当前内容已保留。'+e.message);}
 }
 text(id){return this.states.get(id)?.text||'';}
}
