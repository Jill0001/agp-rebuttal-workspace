let client;
let scope='';
let userId;
export function connectClient(value,identity,project){client=value;userId=identity;scope=project+':'+identity;}
export function draftPrefix(kind){return 'rebuttal:'+scope+':'+kind+':';}
export async function request(path,options={}){
 if(!client)throw Error('请先登录工作台');
 const {data,error}=await client.rpc('workspace_api',{expected_user:userId,method:options.method||'GET',path:decodeURIComponent(path),payload:options.body?JSON.parse(options.body):{}});
 if(error){const e=Error(error.message);e.status=error.code?.startsWith('PT')?Number(error.code.slice(2)):error.code==='PGRST301'?401:500;throw e;}
 return data;
}
