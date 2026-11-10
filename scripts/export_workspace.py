"""Read a consistent SQLite snapshot and create a private, one-time SQL import."""
import argparse
import json
import os
import sqlite3
from pathlib import Path

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def export(db_path, document_path, output):
    document = json.loads(document_path.read_text())
    with sqlite3.connect(db_path.resolve().as_uri() + '?mode=ro', uri=True) as source:
        with sqlite3.connect(':memory:') as snapshot:
            source.backup(snapshot)
            responses = snapshot.execute('SELECT item_id,text,version,updated_at FROM responses').fetchall()
            history = snapshot.execute('SELECT item_id,text,version,updated_at FROM response_history').fetchall()
            comments = snapshot.execute('SELECT id,body FROM comments').fetchall()
    ids = {r[0] for r in responses + history}
    for reviewer in document['reviews']:
        for section in reviewer['sections']:
            for item in section['items']:
                ids.add(item['id'])
                if section['key'] in ('weaknesses', 'questions'):
                    ids.add(item['id'] + '--ideas')
    sql = ["begin;", "lock table public.workspace_document, public.workspace_items, public.workspace_responses, public.workspace_history, public.workspace_comments in access exclusive mode;",
           "do $$begin if exists(select 1 from public.workspace_document) or exists(select 1 from public.workspace_items) or exists(select 1 from public.workspace_responses) or exists(select 1 from public.workspace_history) or exists(select 1 from public.workspace_comments) then raise exception '目标工作台非空，导入已取消'; end if; end$$;",
           'insert into public.workspace_document values (true,' + literal(json.dumps(document, ensure_ascii=False)) + '::jsonb);']
    for item in sorted(ids):
        sql.append('insert into public.workspace_items values (' + literal(item) + ');')
    for table, rows in [('workspace_responses', responses), ('workspace_history', history)]:
        for item, text, version, updated_at in rows:
            sql.append(f'insert into public.{table}(item_id,text,version,updated_at) values (' + ','.join([literal(item), literal(text), str(int(version)), literal(updated_at)]) + ');')
    for cid, body in comments:
        json.loads(body)
        sql.append('insert into public.workspace_comments values (' + literal(cid) + ',' + literal(body) + '::jsonb);')
    sql.append('commit;')
    output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write('\n'.join(sql) + '\n')
    print(f'Exported {len(responses)} responses, {len(history)} history rows, {len(comments)} comments. Keep the SQL file private.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--document', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    export(args.db, args.document, args.output)
