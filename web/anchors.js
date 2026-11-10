const ignored='input,textarea,[contenteditable="true"],#annotations,#selection-add,#comment-composer,#resume-draft';
function element(node){return node?.nodeType===1?node:node?.parentElement;}
export function captureSelection(snapshot){
 const selection=getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const range=selection.getRangeAt(0);if(element(range.startContainer)?.closest(ignored)||element(range.endContainer)?.closest(ignored))return null;
 const quote=range.toString();if(!quote.trim())return null;
 let block=element(range.commonAncestorContainer)?.closest('[data-anchor]');
 if(!block){block=element(range.commonAncestorContainer)?.closest('dialog,[role="dialog"],main,header')||document.querySelector('main');if(!block.contains(range.startContainer)||!block.contains(range.endContainer))return null;block.dataset.anchor=block.tagName==='HEADER'?'site-header':'main-root';}
 const pre=document.createRange();pre.selectNodeContents(block);pre.setEnd(range.startContainer,range.startOffset);const start=pre.toString().length;const text=block.textContent;const note=block.closest('[data-note-id]');
 return {quote,page:location.hash.slice(1)||'/',section:block.dataset.section||'page',anchor:block.dataset.anchor,title:block.dataset.title||document.querySelector('main h1')?.textContent||'AGP Rebuttal',source:block.closest('[data-source]')?.dataset.source||'content/reviews.json',snapshot,context:{view:JSON.parse(document.querySelector('main').dataset.view||'{}'),noteId:note?.dataset.noteId||'',start,end:start+quote.length,prefix:text.slice(Math.max(0,start-60),start),suffix:text.slice(start+quote.length,start+quote.length+60)},range:range.cloneRange()};
}
function rangeAt(root,start,end){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let pos=0,begin=null,finish=null;for(let n=w.nextNode();n;n=w.nextNode()){const next=pos+n.length;if(!begin&&start>=pos&&start<=next)begin=[n,start-pos];if(end>=pos&&end<=next){finish=[n,end-pos];break;}pos=next;}if(!begin||!finish)return null;const r=document.createRange();r.setStart(...begin);r.setEnd(...finish);return r;}
export async function locate(record,navigate,notify){await navigate(record);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));let block=document.querySelector('[data-anchor="'+CSS.escape(record.anchor)+'"]');
 if(!block){block=document.querySelector('[data-note-id]')||document.querySelector('main');notify('原位置已变化，已打开所属页面；提交时的引用仍保留在批注中。');}
 for(let e=block;e;e=e.parentElement)if(e.tagName==='DETAILS')e.open=true;
 if(block.tagName==='DETAILS')block.open=true;
 const text=block.textContent,q=record.quote,c=record.context||{};let start=-1;
 const matchesContext=i=>(!c.prefix||text.slice(Math.max(0,i-c.prefix.length),i)===c.prefix)&&(c.suffix===undefined||text.slice(i+q.length,i+q.length+60)===c.suffix);
 if(Number.isInteger(c.start)&&text.slice(c.start,c.start+q.length)===q&&matchesContext(c.start))start=c.start;
 else {let matches=[];for(let i=text.indexOf(q);i!==-1;i=text.indexOf(q,i+1))matches.push(i);if(matches.length===1)start=matches[0];else{matches=matches.filter(matchesContext);if(matches.length===1)start=matches[0];}}
 document.querySelectorAll('.locate-highlight').forEach(e=>e.classList.remove('locate-highlight'));CSS.highlights?.delete('annotation');block.classList.add('locate-highlight');
 if(start>=0){const r=rangeAt(block,start,start+q.length);if(r&&CSS.highlights)CSS.highlights.set('annotation',new Highlight(r));}else notify('正文已变化或引用无法唯一匹配，已定位到所属内容块。');
 block.scrollIntoView({behavior:'instant',block:'start'});if(start>=0){const visible=rangeAt(block,start,start+q.length);if(visible){const box=visible.getBoundingClientRect();window.scrollBy({top:box.top-Math.max(120,innerHeight*.3),behavior:'smooth'});}}setTimeout(()=>block.classList.remove('locate-highlight'),6000);
}
