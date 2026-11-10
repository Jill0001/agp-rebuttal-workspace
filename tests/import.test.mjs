import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
test('SQLite export preserves content/history and refuses overwriting an imported workspace',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rebuttal-import-'));const db=new PGlite();
 try{
 const source=join(dir,'source.sqlite3'),document=join(dir,'document.json'),out=join(dir,'import.sql');
 execFileSync('python3',['-c',`import sqlite3,sys,json
c=sqlite3.connect(sys.argv[1])
c.executescript('CREATE TABLE responses(item_id,text,version,updated_at); CREATE TABLE response_history(item_id,text,version,updated_at); CREATE TABLE comments(id,body);')
r=('W1',"author's 回复",2,'2026-11-10T00:00:00+00:00')
c.execute('insert into responses values (?,?,?,?)',r)
c.execute('insert into response_history values (?,?,?,?)',r)
c.commit()`,source]);
 await writeFile(document,JSON.stringify({title:'secret',reviews:[{sections:[{key:'weaknesses',items:[{id:'W1'}]}]}]}));
 execFileSync('python3',['scripts/export_workspace.py','--db',source,'--document',document,'--output',out]);
 await db.exec("create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;");
 await db.exec(await readFile('supabase/schema.sql','utf8'));const sql=await readFile(out,'utf8');await db.exec(sql);
 assert.equal((await db.query('select text from public.workspace_responses')).rows[0].text,"author's 回复");
 assert.equal((await db.query('select version from public.workspace_history')).rows[0].version,2);
 await assert.rejects(db.exec(sql),/非空/);
 await db.exec('rollback');assert.equal((await db.query('select count(*) from public.workspace_responses')).rows[0].count,1);
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
