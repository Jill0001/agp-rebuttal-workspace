import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const member='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 await db.query('insert into public.workspace_members values ($1)',[member]);
 await db.query("insert into public.workspace_document values (true, $1)",[{title:'Private review',reviews:[]}]);
 await db.query("insert into public.workspace_items values ('W1')");
 return db;
}
async function as(db,uid,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role '+role);}
async function call(db,method,path,payload={}){return (await db.query('select public.workspace_api($1,$2,$3,$4) as result',[method,path,payload,member])).rows[0].result;}
test('anonymous and nonmembers cannot read or write content or grant membership',async()=>{
 const db=await setup();try{
 await as(db,'','anon');await assert.rejects(call(db,'GET','/api/document'));
 await as(db,outsider);await assert.rejects(call(db,'GET','/api/document'),/permission|权限/i);
 await assert.rejects(db.query('select * from public.workspace_document'));
 await assert.rejects(db.query('insert into public.workspace_members values ($1)',[outsider]));
 await assert.rejects(call(db,'PUT','/api/responses/W1',{text:'attack',version:0}));
 }finally{await db.close();}
});
test('version comparison protects edits and records authenticated author',async()=>{
 const db=await setup();try{
 await as(db,member);
 await assert.rejects(db.query('select public.workspace_api($1,$2,$3,$4)', ['GET','/api/document',{},outsider]),/权限/);
 assert.equal((await call(db,'PUT','/api/responses/W1',{text:'first',version:0})).version,1);
 await assert.rejects(call(db,'PUT','/api/responses/W1',{text:'overwrite',version:0}),/版本/);
 assert.equal((await call(db,'GET','/api/responses')).W1.text,'first');
 await call(db,'PUT','/api/responses/W1',{text:'second',version:1});
 await assert.rejects(call(db,'PUT','/api/responses/unknown',{text:'x',version:0}));
 await assert.rejects(call(db,'PUT','/api/responses/W1',{text:3,version:2}));
 await assert.rejects(call(db,'PUT','/api/responses/W1',{text:'x',version:-1}));
 await db.exec('reset role');const rows=(await db.query('select * from public.workspace_history order by version')).rows;
 assert.equal(rows.length,2);assert.equal(rows[1].updated_by,member);
 }finally{await db.close();}
});
test('comment append and conditional deletion preserve new supplements',async()=>{
 const db=await setup();try{
 await as(db,member);const c=await call(db,'POST','/api/comments',{page:'/W1',anchor:'W1',quote:'quote',text:'question'});
 const updated=await call(db,'PATCH','/api/comments/'+c.id,{reply:'supplement',author:'user'});
 assert.equal(updated.replies[0].text,'supplement');assert.equal(updated.replies[0].user_id,member);
 await assert.rejects(call(db,'DELETE','/api/comments/'+c.id,{expected_updated_at:c.updated_at}),/新补充/);
 await call(db,'DELETE','/api/comments/'+c.id,{expected_updated_at:updated.updated_at});
 assert.deepEqual(await call(db,'GET','/api/comments'),[]);
 await assert.rejects(call(db,'POST','/api/comments',{page:'//outside',anchor:'x',quote:'q',text:'t'}));
 await assert.rejects(call(db,'POST','/api/comments',{page:'/x',anchor:'x',quote:'q',text:'t',context:[]}));
 }finally{await db.close();}
});
