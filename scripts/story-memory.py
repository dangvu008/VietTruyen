#!/usr/bin/env python3
from __future__ import annotations

import argparse, hashlib, json, re, sqlite3, sys
from pathlib import Path
from datetime import datetime, timezone

try:
    import yaml
except Exception as exc:
    raise SystemExit('PyYAML is required: pip install pyyaml') from exc

ROOT = Path(__file__).resolve().parents[1]
STORY_CFG = ROOT / 'story.yaml'
PASS = 'PASS'

SCHEMA = r'''
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chapters(story_id TEXT,chapter INTEGER,status TEXT,path TEXT,sha256 TEXT,PRIMARY KEY(story_id,chapter));
CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY AUTOINCREMENT,story_id TEXT,chapter INTEGER,source_path TEXT,body TEXT,authority TEXT,sha256 TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(body,source_path,content='chunks',content_rowid='id',tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN INSERT INTO chunks_fts(rowid,body,source_path) VALUES(new.id,new.body,new.source_path); END;
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN INSERT INTO chunks_fts(chunks_fts,rowid,body,source_path) VALUES('delete',old.id,old.body,old.source_path); END;
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,story_id TEXT,chapter INTEGER,event_type TEXT,subject TEXT,field TEXT,value TEXT,world TEXT,location TEXT,source_path TEXT,confidence REAL DEFAULT 1.0,status TEXT DEFAULT 'accepted');
CREATE INDEX IF NOT EXISTS events_subject ON events(story_id,subject,field,chapter DESC);
CREATE TABLE IF NOT EXISTS current_state(story_id TEXT,subject TEXT,field TEXT,value TEXT,world TEXT,location TEXT,source_chapter INTEGER,source_event INTEGER,PRIMARY KEY(story_id,subject,field));
CREATE TABLE IF NOT EXISTS knowledge(id INTEGER PRIMARY KEY AUTOINCREMENT,story_id TEXT,claim_id TEXT,layer TEXT,holder TEXT,value TEXT,chapter INTEGER,certainty REAL DEFAULT 1.0,source_path TEXT,status TEXT DEFAULT 'active');
CREATE INDEX IF NOT EXISTS knowledge_claim ON knowledge(story_id,claim_id,layer,chapter DESC);
CREATE TABLE IF NOT EXISTS nodes(story_id TEXT,node_id TEXT,node_type TEXT,label TEXT,PRIMARY KEY(story_id,node_id));
CREATE TABLE IF NOT EXISTS edges(id INTEGER PRIMARY KEY AUTOINCREMENT,story_id TEXT,from_node TEXT,relation TEXT,to_node TEXT,valid_from INTEGER,valid_to INTEGER,source_path TEXT,confidence REAL DEFAULT 1.0);
CREATE INDEX IF NOT EXISTS edges_from ON edges(story_id,from_node,valid_from DESC);
CREATE INDEX IF NOT EXISTS edges_to ON edges(story_id,to_node,valid_from DESC);
CREATE TABLE IF NOT EXISTS threads(story_id TEXT,thread_id TEXT,title TEXT,status TEXT,opened_chapter INTEGER,updated_chapter INTEGER,resolved_chapter INTEGER,summary TEXT,source_path TEXT,PRIMARY KEY(story_id,thread_id));
CREATE TABLE IF NOT EXISTS checkpoints(story_id TEXT,chapter INTEGER,sha256 TEXT,created_at TEXT,PRIMARY KEY(story_id,chapter));
CREATE TABLE IF NOT EXISTS health(story_id TEXT,chapter INTEGER,metric TEXT,value REAL,source TEXT,PRIMARY KEY(story_id,chapter,metric));
'''

def fail(msg,code=2):
    print('MEMORY_HOLD:',msg,file=sys.stderr); raise SystemExit(code)

def load_yaml(path: Path):
    if not path.exists(): fail(f'missing {path}')
    return yaml.safe_load(path.read_text(encoding='utf-8')) or {}

def story():
    cfg=load_yaml(STORY_CFG); sid=cfg.get('active_story')
    if not sid: fail('story.yaml missing active_story')
    root=ROOT/'stories'/sid; man=load_yaml(root/'manifest.yaml')
    return sid,root,man

def dbfile(root): return root/'memory'/'story.db'
def connect(root):
    p=dbfile(root); p.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(p); c.row_factory=sqlite3.Row; c.executescript(SCHEMA); return c

def sha(s): return hashlib.sha256(s.encode()).hexdigest()
def now(): return datetime.now(timezone.utc).isoformat()

def chunks(text,limit=4500):
    paras=[p.strip() for p in re.split(r'\n\s*\n',text) if p.strip()]; out=[]; cur=[]; n=0
    for p in paras:
        if cur and n+len(p)>limit: out.append('\n\n'.join(cur)); cur=[]; n=0
        cur.append(p); n+=len(p)+2
    if cur: out.append('\n\n'.join(cur))
    return out

def cmd_init(a):
    sid,root,_=story(); c=connect(root); c.execute("INSERT OR REPLACE INTO meta(key,value) VALUES('story_id',?)",(sid,)); c.commit(); c.close(); print(dbfile(root))

def cmd_ingest(a):
    sid,root,man=story(); p=Path(a.file)
    if not p.exists(): fail('chapter file missing')
    if not a.accepted: fail('memory ingest accepts only reviewed/accepted prose')
    text=p.read_text(encoding='utf-8'); h=sha(text); c=connect(root)
    c.execute('DELETE FROM chunks WHERE story_id=? AND chapter=?',(sid,a.chapter))
    c.execute('INSERT OR REPLACE INTO chapters VALUES(?,?,?,?,?)',(sid,a.chapter,'accepted',str(p.relative_to(root)) if root in p.parents else str(p),h))
    for body in chunks(text): c.execute('INSERT INTO chunks(story_id,chapter,source_path,body,authority,sha256) VALUES(?,?,?,?,?,?)',(sid,a.chapter,str(p),'published_evidence',sha(body)))
    c.commit(); c.close(); print(f'INGESTED ch{a.chapter:04d}')

def cmd_event(a):
    sid,root,_=story(); c=connect(root)
    cur=c.execute('INSERT INTO events(story_id,chapter,event_type,subject,field,value,world,location,source_path,confidence,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(sid,a.chapter,a.type,a.subject,a.field,a.value,a.world,a.location,a.source,a.confidence,'accepted'))
    eid=cur.lastrowid
    if a.subject and a.field:
        c.execute('INSERT OR REPLACE INTO current_state(story_id,subject,field,value,world,location,source_chapter,source_event) VALUES(?,?,?,?,?,?,?,?)',(sid,a.subject,a.field,a.value,a.world,a.location,a.chapter,eid))
    c.commit(); c.close(); print(eid)

def cmd_knowledge(a):
    if a.layer not in {'objective_truth','reader_knowledge','character_knowledge','belief_or_rumor'}: fail('invalid knowledge layer')
    sid,root,_=story(); c=connect(root)
    c.execute('INSERT INTO knowledge(story_id,claim_id,layer,holder,value,chapter,certainty,source_path,status) VALUES(?,?,?,?,?,?,?,?,?)',(sid,a.claim_id,a.layer,a.holder,a.value,a.chapter,a.certainty,a.source,'active'))
    c.commit(); c.close(); print('OK')

def cmd_edge(a):
    sid,root,_=story(); c=connect(root)
    for n in (a.from_node,a.to_node): c.execute('INSERT OR IGNORE INTO nodes VALUES(?,?,?,?)',(sid,n,'entity',n))
    c.execute('INSERT INTO edges(story_id,from_node,relation,to_node,valid_from,valid_to,source_path,confidence) VALUES(?,?,?,?,?,?,?,?)',(sid,a.from_node,a.relation,a.to_node,a.chapter,a.valid_to,a.source,a.confidence))
    c.commit(); c.close(); print('OK')

def qfts(q):
    toks=[x for x in re.findall(r'[\wÀ-ỹ]+',q,re.UNICODE) if len(x)>1][:18]
    return ' OR '.join('"'+x.replace('"','')+'"' for x in toks)

def cmd_retrieve(a):
    sid,root,man=story(); c=connect(root); target=a.target_chapter or int(man.get('next_chapter',1)); fq=qfts(a.query)
    state=c.execute('SELECT * FROM current_state WHERE story_id=? AND source_chapter<? ORDER BY subject,field',(sid,target)).fetchall()
    threads=c.execute("SELECT * FROM threads WHERE story_id=? AND status!='resolved' ORDER BY updated_chapter DESC LIMIT 30",(sid,)).fetchall()
    know=c.execute("SELECT * FROM knowledge WHERE story_id=? AND chapter<? AND status='active' ORDER BY chapter DESC LIMIT 80",(sid,target)).fetchall()
    hits=[]
    if fq: hits=c.execute('SELECT c.*,bm25(chunks_fts) score FROM chunks_fts JOIN chunks c ON c.id=chunks_fts.rowid WHERE chunks_fts MATCH ? AND c.story_id=? AND c.chapter<? ORDER BY score LIMIT ?',(fq,sid,target,a.limit)).fetchall()
    edges=[]
    for e in a.entity or []: edges += c.execute('SELECT * FROM edges WHERE story_id=? AND valid_from<? AND (from_node=? OR to_node=?) ORDER BY valid_from DESC LIMIT 30',(sid,target,e,e)).fetchall()
    c.close()
    out=[f'# MEMORY CONTEXT — {sid} → ch{target}',f'Query: {a.query}','\n## Current state']
    out += [f"- {r['subject']}.{r['field']} = {r['value']} (ch{r['source_chapter']})" for r in state] or ['- empty']
    out += ['\n## Open threads']+[f"- {r['thread_id']}: {r['summary'] or r['title']}" for r in threads] or ['- none']
    out += ['\n## Knowledge']+[f"- {r['claim_id']} [{r['layer']}/{r['holder'] or '-'}] ch{r['chapter']}: {r['value']}" for r in know]
    out += ['\n## Graph']+[f"- {r['from_node']} --{r['relation']}--> {r['to_node']} (ch{r['valid_from']})" for r in edges]
    out += ['\n## Retrieved accepted prose']
    for i,r in enumerate(hits,1): out.append(f"\n### {i}. ch{r['chapter']} {r['source_path']}\n{r['body'][:2200]}")
    out += ['\n## Guard','- accepted prose outranks projections','- planning is not evidence','- belief/rumor is not objective truth','- no cross-world relation becomes confirmed without accepted evidence']
    text='\n'.join(out)
    if a.output: Path(a.output).write_text(text,encoding='utf-8'); print(a.output)
    else: print(text)

def cmd_rebuild(a):
    sid,root,_=story(); c=connect(root)
    c.execute('DELETE FROM current_state WHERE story_id=?',(sid,))
    rows=c.execute("SELECT * FROM events WHERE story_id=? AND status='accepted' ORDER BY chapter,id",(sid,)).fetchall()
    for r in rows:
        if r['subject'] and r['field']:
            c.execute('INSERT OR REPLACE INTO current_state(story_id,subject,field,value,world,location,source_chapter,source_event) VALUES(?,?,?,?,?,?,?,?)',(sid,r['subject'],r['field'],r['value'],r['world'],r['location'],r['chapter'],r['id']))
    c.commit(); c.close(); print(f'REBUILT current_state from {len(rows)} events')

def cmd_checkpoint(a):
    sid,root,man=story(); c=connect(root); ch=a.chapter or int(man.get('latest_accepted_chapter',0))
    payload={'chapter':ch,'state':[dict(r) for r in c.execute('SELECT * FROM current_state WHERE story_id=? ORDER BY subject,field',(sid,))], 'threads':[dict(r) for r in c.execute("SELECT * FROM threads WHERE story_id=? AND status!='resolved' ORDER BY thread_id",(sid,))]}
    h=sha(json.dumps(payload,ensure_ascii=False,sort_keys=True)); c.execute('INSERT OR REPLACE INTO checkpoints VALUES(?,?,?,?)',(sid,ch,h,now())); c.commit(); c.close()
    out=root/'checkpoints'/f'memory-{ch:04d}.yaml'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(yaml.safe_dump({'schema_version':1,'story_id':sid,'chapter':ch,'sha256':h,'status':PASS},allow_unicode=True,sort_keys=False),encoding='utf-8'); print(out)

def cmd_health(a):
    sid,root,man=story(); c=connect(root); ch=a.chapter or int(man.get('latest_accepted_chapter',0)); metrics={}
    for name,val in [('temporal_state_accuracy',a.temporal),('graph_consistency',a.graph),('knowledge_boundary_accuracy',a.knowledge),('open_thread_coverage',a.threads),('provenance_integrity',a.provenance),('checkpoint_integrity',a.checkpoint),('retrieval_recall_at_10',a.retrieval),('cold_memory_recall',a.cold)]:
        metrics[name]=val; c.execute('INSERT OR REPLACE INTO health VALUES(?,?,?,?,?)',(sid,ch,name,val,'manual_or_benchmark'))
    overall=sum(metrics.values())/len(metrics); c.execute('INSERT OR REPLACE INTO health VALUES(?,?,?,?,?)',(sid,ch,'overall',overall,'computed_mean')); c.commit(); c.close()
    status='PASS' if overall>=.95 else ('DEGRADED' if overall>=.90 else 'HOLD')
    out=root/'audits'/f'memory-health-{ch:04d}.yaml'; out.write_text(yaml.safe_dump({'schema_version':1,'story_id':sid,'chapter':ch,'status':status,'metrics':{**metrics,'overall':round(overall,4)}},allow_unicode=True,sort_keys=False),encoding='utf-8'); print(out)
    if status=='HOLD': raise SystemExit(3)

def cmd_stats(a):
    sid,root,_=story(); c=connect(root)
    for t in ['chapters','chunks','events','current_state','knowledge','edges','threads','checkpoints','health']:
        print(f'{t}:',c.execute(f'SELECT COUNT(*) FROM {t} WHERE story_id=?',(sid,)).fetchone()[0])
    c.close()

def parser():
    p=argparse.ArgumentParser(prog='story-memory'); sp=p.add_subparsers(dest='cmd',required=True)
    s=sp.add_parser('init'); s.set_defaults(func=cmd_init)
    s=sp.add_parser('ingest'); s.add_argument('--chapter',type=int,required=True); s.add_argument('--file',required=True); s.add_argument('--accepted',action='store_true'); s.set_defaults(func=cmd_ingest)
    s=sp.add_parser('event'); s.add_argument('--chapter',type=int,required=True); s.add_argument('--type',required=True); s.add_argument('--subject'); s.add_argument('--field'); s.add_argument('--value'); s.add_argument('--world'); s.add_argument('--location'); s.add_argument('--source'); s.add_argument('--confidence',type=float,default=1.0); s.set_defaults(func=cmd_event)
    s=sp.add_parser('knowledge'); s.add_argument('--claim-id',required=True); s.add_argument('--layer',required=True); s.add_argument('--holder'); s.add_argument('--value',required=True); s.add_argument('--chapter',type=int,required=True); s.add_argument('--certainty',type=float,default=1.0); s.add_argument('--source'); s.set_defaults(func=cmd_knowledge)
    s=sp.add_parser('edge'); s.add_argument('--from-node',required=True); s.add_argument('--relation',required=True); s.add_argument('--to-node',required=True); s.add_argument('--chapter',type=int,required=True); s.add_argument('--valid-to',type=int); s.add_argument('--source'); s.add_argument('--confidence',type=float,default=1.0); s.set_defaults(func=cmd_edge)
    s=sp.add_parser('retrieve'); s.add_argument('--query',required=True); s.add_argument('--target-chapter',type=int); s.add_argument('--entity',action='append'); s.add_argument('--limit',type=int,default=12); s.add_argument('--output'); s.set_defaults(func=cmd_retrieve)
    s=sp.add_parser('rebuild'); s.set_defaults(func=cmd_rebuild)
    s=sp.add_parser('checkpoint'); s.add_argument('--chapter',type=int); s.set_defaults(func=cmd_checkpoint)
    s=sp.add_parser('health'); s.add_argument('--chapter',type=int); [s.add_argument('--'+x,type=float,default=1.0) for x in ['temporal','graph','knowledge','threads','provenance','checkpoint','retrieval','cold']]; s.set_defaults(func=cmd_health)
    s=sp.add_parser('stats'); s.set_defaults(func=cmd_stats)
    return p

if __name__=='__main__':
    a=parser().parse_args(); a.func(a)
