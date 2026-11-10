import {build} from 'esbuild';
import {mkdir,rm,copyFile,writeFile} from 'node:fs/promises';
const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(url||key){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Expected Supabase HTTPS project URL');
 if(!key.startsWith('sb_publishable_'))throw Error('Use a Supabase publishable key, never a secret or service-role key');
}
await rm('dist',{recursive:true,force:true});await mkdir('dist');
await build({entryPoints:['web/entry.js'],bundle:true,format:'esm',outfile:'dist/entry.js',minify:true,define:{__SUPABASE_URL__:JSON.stringify(url),__SUPABASE_KEY__:JSON.stringify(key)}});
for(const file of ['index.html','style.css'])await copyFile('web/'+file,'dist/'+file);
await writeFile('dist/.nojekyll','');
console.log(url?'Built configured workspace':'Built setup screen. Supabase configuration is still required.');
