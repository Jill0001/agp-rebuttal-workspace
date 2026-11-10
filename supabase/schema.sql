begin;
create table public.workspace_members (user_id uuid primary key);
create table public.workspace_document (singleton boolean primary key default true check(singleton), body jsonb not null);
create table public.workspace_items (item_id text primary key);
create table public.workspace_responses (
 item_id text primary key references public.workspace_items, text text not null default '' check(length(text)<=50000),
 version integer not null default 0 check(version>=0), updated_at timestamptz not null default clock_timestamp(), updated_by uuid
);
create table public.workspace_history (
 item_id text not null references public.workspace_items, text text not null, version integer not null,
 updated_at timestamptz not null, updated_by uuid, primary key(item_id,version)
);
create table public.workspace_comments (id uuid primary key, body jsonb not null);
alter table public.workspace_members enable row level security;
alter table public.workspace_document enable row level security;
alter table public.workspace_items enable row level security;
alter table public.workspace_responses enable row level security;
alter table public.workspace_history enable row level security;
alter table public.workspace_comments enable row level security;
revoke all on public.workspace_members, public.workspace_document, public.workspace_items,
 public.workspace_responses, public.workspace_history, public.workspace_comments from public, anon, authenticated;

create function public.workspace_text(data jsonb, field text, maximum integer, required boolean default false)
returns text language plpgsql set search_path='' as $$
declare value text;
begin
 if data ? field and jsonb_typeof(data->field)<>'string' then raise exception using errcode='PT400',message=field||' 必须为文字'; end if;
 value=coalesce(data->>field,'');
 if length(value)>maximum or (required and length(btrim(value))=0) then raise exception using errcode='PT400',message=field||' 长度无效'; end if;
 return value;
end $$;
revoke all on function public.workspace_text(jsonb,text,integer,boolean) from public,anon,authenticated;

-- The RPC owns writes so clients cannot bypass membership, validation, history or version checks.
create function public.workspace_api(method text,path text,payload jsonb default '{}'::jsonb,expected_user uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); item text; result jsonb; rec public.workspace_responses;
 cid uuid; old jsonb; stamp text; value text; v integer; k text; context jsonb;
begin
 if actor is null or actor is distinct from expected_user or not exists(select 1 from public.workspace_members where user_id=actor) then
  raise exception using errcode='PT403',message='你没有此工作台的访问权限，请联系所有者';
 end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='PT400',message='需要 JSON 对象'; end if;
 if method='GET' and path='/api/document' then
  select body into result from public.workspace_document;
  if result is null then raise exception using errcode='PT503',message='工作台尚未导入数据'; end if;
  return result;
 elsif method='GET' and path='/api/responses' then
  select coalesce(jsonb_object_agg(item_id,to_jsonb(r)),'{}') into result from public.workspace_responses r;return result;
 elsif method='GET' and path='/api/comments' then
  select coalesce(jsonb_agg(body order by body->>'created_at' desc),'[]') into result from public.workspace_comments;return result;
 elsif method='PUT' and path like '/api/responses/%' then
  item=substring(path from 16);
  if not exists(select 1 from public.workspace_items where item_id=item) then raise exception using errcode='PT404',message='回复条目不存在'; end if;
  value=public.workspace_text(payload,'text',50000);
  if jsonb_typeof(payload->'version') is distinct from 'number' or (payload->>'version')!~'^[0-9]{1,9}$' then raise exception using errcode='PT400',message='version 必须为非负整数'; end if;
  v=(payload->>'version')::integer;
  insert into public.workspace_responses(item_id) values(item) on conflict do nothing;
  select * into rec from public.workspace_responses where item_id=item for update;
  if rec.version<>v then raise exception using errcode='PT409',message='版本已更新，请合并后再保存'; end if;
  update public.workspace_responses set text=value,version=v+1,updated_at=clock_timestamp(),updated_by=actor where item_id=item returning * into rec;
  insert into public.workspace_history select rec.*;
  return to_jsonb(rec);
 elsif method='POST' and path='/api/comments' then
  result='{}';
  for k in select unnest(array['page','section','anchor','title','quote','text','source','snapshot']) loop
   value=public.workspace_text(payload,k,case k when 'quote' then 12000 when 'text' then 10000 when 'page' then 500 when 'title' then 500 when 'source' then 1000 else 200 end,k in ('page','anchor','quote','text'));
   result=result||jsonb_build_object(k,value);
  end loop;
  if result->>'page' not like '/%' or result->>'page' like '//%' then raise exception using errcode='PT400',message='page 必须为站内路径'; end if;
  context=coalesce(payload->'context','{}');
  if jsonb_typeof(context)<>'object' or length(context::text)>16000 then raise exception using errcode='PT400',message='context 无效'; end if;
  foreach k in array array['noteId','prefix','suffix','blockText'] loop
   if context ? k and jsonb_typeof(context->k)<>'string' then raise exception using errcode='PT400',message='context 文字类型无效'; end if;
  end loop;
  foreach k in array array['start','end'] loop
   if context ? k and (jsonb_typeof(context->k)<>'number' or context->>k !~ '^[0-9]+$') then raise exception using errcode='PT400',message='选区偏移无效'; end if;
  end loop;
  cid=gen_random_uuid();stamp=clock_timestamp()::text;
  result=result||jsonb_build_object('id',cid,'context',context,'created_at',stamp,'updated_at',stamp,'created_by',actor,'status','open','replies','[]'::jsonb);
  insert into public.workspace_comments values(cid,result);return result;
 elsif method in ('PATCH','DELETE') and path like '/api/comments/%' then
  begin cid=substring(path from 15)::uuid;exception when invalid_text_representation then raise exception using errcode='PT404',message='批注不存在';end;
  select body into old from public.workspace_comments where id=cid for update;
  if old is null then raise exception using errcode='PT404',message='批注不存在，请刷新';end if;
  if method='DELETE' then
   if payload->>'expected_updated_at' is distinct from old->>'updated_at' then raise exception using errcode='PT409',message='批注刚有新补充，请刷新后重新检查';end if;
   delete from public.workspace_comments where id=cid;return jsonb_build_object('deleted',true);
  end if;
  value=public.workspace_text(payload,'reply',10000,true);stamp=greatest(clock_timestamp(),(old->>'updated_at')::timestamptz+interval '1 microsecond')::text;
  result=old||jsonb_build_object('updated_at',stamp,'replies',(old->'replies')||jsonb_build_array(jsonb_build_object('text',value,'author','user','user_id',actor,'created_at',stamp)));
  update public.workspace_comments set body=result where id=cid;return result;
 end if;
 raise exception using errcode='PT404',message='未知接口';
end $$;
revoke all on function public.workspace_api(text,text,jsonb,uuid) from public,anon;
grant execute on function public.workspace_api(text,text,jsonb,uuid) to authenticated;
commit;
