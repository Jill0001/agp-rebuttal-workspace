import {captureSelection} from './anchors.js';
import {toast} from './ui.js';

export function initComposer({snapshot,read,save,submit}) {
 const box=document.querySelector('#comment-composer'),form=document.querySelector('#comment-form'),input=document.querySelector('#comment-text'),preview=document.querySelector('#quote-preview'),quote=document.querySelector('#quote-text'),error=document.querySelector('#comment-error'),add=document.querySelector('#selection-add'),resume=document.querySelector('#resume-draft'),button=document.querySelector('#comment-save');
 let draft=read('draft',{text:'',selection:null}),selection=draft.selection,pending=null,range=null,point=draft.point||{left:24,top:100,bottom:100},busy=false,composing=false;
 input.value=draft.text||'';
 function stash(){save('draft',{text:input.value,selection,point});resume.hidden=!(selection||input.value);}
 function render(){preview.hidden=!selection;quote.textContent=selection?.quote||'';resume.hidden=!(selection||input.value);}
 function rect(){return range?.startContainer.isConnected?range.getBoundingClientRect():point;}
 function place(target,r){const view=window.visualViewport;const left=view?.offsetLeft||0,top=view?.offsetTop||0,w=view?.width||innerWidth,h=view?.height||innerHeight;target.style.maxHeight=Math.max(80,h-16)+'px';target.style.maxWidth=Math.max(80,w-16)+'px';const b=target.getBoundingClientRect();const x=Math.max(left+8,Math.min(left+w-b.width-8,r.left));const below=r.bottom+8;const y=below+b.height<=top+h-8?below:r.top-b.height-8;target.style.left=x+'px';target.style.top=Math.max(top+8,Math.min(top+h-b.height-8,y))+'px';}
 function position(){if(!box.hidden)place(box,rect());if(!pending?.range||pending.range.collapsed||!pending.range.startContainer.isConnected){add.hidden=true;return;}const r=pending.range.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight){add.hidden=true;return;}add.hidden=false;place(add,r);}
 function open(){box.hidden=false;render();position();input.focus({preventScroll:true});}
 function close(){stash();box.hidden=true;pending=null;add.hidden=true;resume.focus({preventScroll:true});}
 window.addEventListener('library:navigated',()=>{stash();box.hidden=true;pending=null;range=null;add.hidden=true;});
 render();input.oninput=stash;resume.onclick=open;document.querySelector('#composer-close').onclick=close;
 document.querySelector('#cancel-quote').onclick=()=>{selection=null;range=null;render();stash();input.focus();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden&&!e.isComposing&&!composing){e.preventDefault();close();}});
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!composing&&e.keyCode!==229){e.preventDefault();form.requestSubmit();}};
 document.addEventListener('selectionchange',()=>{pending=captureSelection(snapshot);position();});
 add.onpointerdown=e=>e.preventDefault();add.onclick=()=>{if(!pending)return;const {range:selected,...meta}=pending;range=selected;const r=range.getBoundingClientRect();point={left:r.left,top:r.top,bottom:r.bottom};selection=meta;pending=null;add.hidden=true;error.textContent='';stash();open();};
 window.addEventListener('scroll',position,true);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);new ResizeObserver(()=>{if(!box.hidden)place(box,rect());}).observe(box);
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;error.textContent='';if(!selection?.quote?.trim()){error.textContent='请先选择需要批注的原文。';return;}if(!input.value.trim()){error.textContent='请输入问题或修改意见。';return;}if(Array.from(input.value).length>10000||Array.from(selection.quote).length>12000){error.textContent='问题最多10000字符，引用最多12000字符，请缩短后重试。';return;}
 const sent={...selection,text:input.value};busy=true;button.disabled=true;
 try{await submit(sent);if(JSON.stringify({...selection,text:input.value})===JSON.stringify(sent)){selection=null;range=null;input.value='';render();stash();box.hidden=true;pending=null;add.hidden=true;}toast('批注已保存');}
 catch(e){error.textContent='保存失败：'+e.message;}
 finally{busy=false;button.disabled=false;}
 };
 return {get busy(){return busy;}};
}
