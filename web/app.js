import {el,api,toast} from './ui.js';
import {Responses} from './responses.js';
import {initAnnotations} from './annotations.js';
const main=document.querySelector('main'),tabs=document.querySelector('#reviewer-tabs');
let doc,responses,activeReviewer;
const names={summary:'摘要',strengths:'优点',weaknesses:'缺点',questions:'问题'};
function anchor(node,id,title,section='page'){node.dataset.anchor=id;node.dataset.title=title;node.dataset.section=section;return node;}
function route(){const [reviewer,section]=location.hash.replace(/^#\/?/,'').split('/');const selected=doc.reviews.find(r=>r.reviewer===reviewer)||doc.reviews[0];
 for(const panel of document.querySelectorAll('.reviewer'))panel.hidden=panel.dataset.reviewer!==selected.reviewer;
 for(const tab of tabs.querySelectorAll('[role="tab"]')){const active=tab.dataset.reviewer===selected.reviewer;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
 main.dataset.view=JSON.stringify({reviewer:selected.reviewer});
 if(section){const target=document.querySelector(`[data-anchor="${CSS.escape(selected.reviewer+'-'+section)}"]`);if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView({block:'start'});}
 if(!section&&activeReviewer&&activeReviewer!==selected.reviewer)document.querySelector('[data-anchor="'+selected.reviewer+'-heading"]')?.scrollIntoView({block:'start'});activeReviewer=selected.reviewer;
 window.dispatchEvent(new Event('library:navigated'));
}
function progress(){if(!doc||!responses)return;const all=[...responses.states.values()].filter(s=>s.kind!=='ideas'),written=all.filter(s=>s.text.trim()).length;document.querySelector('#written-count').textContent=written;document.querySelector('#total-count').textContent=all.length;
 for(const r of doc.reviews){const states=all.filter(s=>s.id.startsWith(r.reviewer+'-'));const node=document.querySelector('[data-progress="'+r.reviewer+'"]');if(node)node.textContent=states.filter(s=>s.text.trim()).length+' / '+states.length;}
 const pending=[...responses.states.values()].filter(s=>s.dirty||s.busy).length;document.querySelector('#overall-save').textContent=pending?pending+' 条待保存':'回复自动保存到云端';}
function reviewerView(r){
 const panel=el('article','reviewer');panel.dataset.reviewer=r.reviewer;panel.id='panel-'+r.reviewer;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+r.reviewer);
 const heading=anchor(el('div','reviewer-heading'),r.reviewer+'-heading','Reviewer '+r.reviewer);heading.append(el('p','eyebrow','OFFICIAL REVIEW'),el('h2','','Reviewer '+r.reviewer));
 const source=el('a','source-link','查看 OpenReview 原文 ↗');source.href=doc.url+'&noteId='+r.id;source.target='_blank';source.rel='noreferrer';heading.append(source,el('p','source-date',r.date+' · America/Chicago'));panel.append(heading);const sectionNav=el('nav','reviewer-sections');sectionNav.setAttribute('aria-label','Reviewer '+r.reviewer+' 章节');for(const section of r.sections){const link=el('a','',names[section.key]);link.href='#/'+r.reviewer+'/'+section.key;sectionNav.append(link);}panel.append(sectionNav);
 const scoreGroup=anchor(el('details','review-fold'),r.reviewer+'-scores','Reviewer '+r.reviewer+' 评分','scores');scoreGroup.append(el('summary','','原始评分与伦理标记'));
 const table=el('table','scores'),tbody=el('tbody');table.setAttribute('aria-label','原始评分与伦理标记');
 for(const score of r.scores){const row=el('tr'),key=el('th','',score.label);key.scope='row';row.append(key,el('td','',score.text));tbody.append(row);}table.append(tbody);scoreGroup.append(table);panel.append(scoreGroup);
 for(const section of r.sections){
  const folded=section.key==='summary'||section.key==='strengths';
  const group=anchor(el(folded?'details':'section',folded?'review-fold':'review-section'),r.reviewer+'-'+section.key,r.reviewer+' '+section.title,section.title);
  if(folded){
   group.append(el('summary','',section.title+' · '+names[section.key]));
   const content=el(section.key==='strengths'?'ol':'div','fold-content');
   for(const item of section.items){const block=anchor(el(section.key==='strengths'?'li':'p','review-text',item.text),item.id,r.reviewer+' '+section.title+' '+item.number,section.title);block.dataset.source='content/reviews.json#'+item.id;content.append(block);}
   group.append(content);panel.append(group);continue;
  }
  group.append(el('h3','section-title',section.title),el('p','section-hint',names[section.key]+' · '+section.items.length+' 个条目'));
  for(const item of section.items){const card=el('div','issue-card');card.style.setProperty('--depth',Math.min(item.depth,2));card.dataset.itemId=item.id;
   const original=anchor(el('div','review-original'),item.id,r.reviewer+' '+section.title+' '+item.number,section.title);original.dataset.source='content/reviews.json#'+item.id;
   original.append(el('div','item-number',(section.key==='weaknesses'?'W':'Q')+item.number));
   original.append(el('h4','reading-label','原文'));
   original.append(el('p','review-text',item.text));card.append(original);
   {
    for(const [key,label] of [['translation','中文译文'],['interpretation','解读与回复思路']]){const block=anchor(el('div','weakness-'+key),item.id+'-'+key,r.reviewer+' '+(section.key==='weaknesses'?'W':'Q')+item.number+' '+label,section.title);block.dataset.source='content/'+(section.key==='weaknesses'?'weakness':'question')+'-notes.json#'+item.id+'.'+key;block.append(el('h4','reading-label',label),el('p','reading-text',item[key]));card.append(block);}
   }
   card.append(responses.attach(item,r.reviewer,section.title,'ideas'),responses.attach(item,r.reviewer,section.title));group.append(card);
  }panel.append(group);
 }return panel;
}
function exportDraft(){const lines=['# AGP ICLR 2027 Rebuttal','',doc.title,'',doc.url,''];for(const r of doc.reviews){lines.push('## Reviewer '+r.reviewer,'');for(const s of r.sections){lines.push('### '+s.title,'');for(const i of s.items){lines.push('#### '+i.number,'','> '+i.text.replaceAll('\n','\n> '),'',...(s.key==='weaknesses'||s.key==='questions'?['**人工撰写回复思路**','',responses.text(i.id+'--ideas')||'（尚未填写）','','**最终回复**','',responses.text(i.id)||'（尚未填写）']:[]),'');}}}const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));const link=el('a');link.href=url;link.download='AGP-ICLR2027-rebuttal.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('已导出当前思路和最终回复。');}
async function boot(){try{const result=await Promise.all([api('/api/document'),api('/api/responses')]);doc=result[0];responses=new Responses(result[1],progress);main.replaceChildren();
 const hero=anchor(el('section','hero'),'site-intro','AGP 评审与回复');hero.append(el('p','eyebrow','评审与回复工作台'),el('h1','','AGP 评审与回复'),el('p','paper-title',doc.title),el('p','intro','阅读三份评审，逐条撰写和修改回复。选中文字可添加批注。'));
 const stats=el('div','stats');stats.innerHTML='<span><b>3</b> 份评审</span><span><b id="written-count">0</b> / <span id="total-count">28</span> 条已填写</span><span id="overall-save">回复自动保存到云端</span>';hero.append(stats);main.append(hero);
 tabs.replaceChildren();for(const r of doc.reviews){const tab=el('button','reviewer-tab');tab.id='tab-'+r.reviewer;tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-controls','panel-'+r.reviewer);tab.dataset.reviewer=r.reviewer;tab.append(el('span','tab-icon','R'),el('span','tab-label','Reviewer '+r.reviewer));const count=el('span','tab-count');count.dataset.progress=r.reviewer;tab.append(count);
 tab.onclick=()=>{location.hash='/'+r.reviewer;};tabs.append(tab);main.append(reviewerView(r));}
 tabs.onkeydown=e=>{const list=[...tabs.querySelectorAll('[role="tab"]')],current=list.indexOf(document.activeElement);if(current<0)return;let next;if(e.key==='ArrowRight')next=(current+1)%list.length;else if(e.key==='ArrowLeft')next=(current+list.length-1)%list.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=list.length-1;else return;e.preventDefault();list[next].focus();list[next].click();};
 document.querySelector('#export').onclick=exportDraft;
 window.addEventListener('workspace:refresh',()=>responses.refresh());
 window.addEventListener('hashchange',route);route();progress();initAnnotations({snapshot:doc.snapshot,navigate:async record=>{location.hash=record.page;route();}});
 }catch(e){main.replaceChildren(el('h1','','读取工作台失败'),el('p','',e.message));const retry=el('button','','重新加载');retry.onclick=()=>location.reload();main.append(retry);}}
export {boot};
