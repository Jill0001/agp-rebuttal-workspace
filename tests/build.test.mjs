import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';
test('public bundle contains only allowed web assets and rejects secret keys',async()=>{
 const env={...process.env,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
 execFileSync(process.execPath,['scripts/build.mjs'],{env});
 assert.deepEqual((await readdir('dist')).sort(),['.nojekyll','entry.js','index.html','style.css']);
 const html=await readFile('dist/index.html','utf8');assert.match(html,/src="\.\/entry.js"/);assert.match(html,/href="\.\/style.css"/);
 assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{env:{...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_must_not_publish'},stdio:'pipe'}),/publishable key/);
});
