#!/usr/bin/env python3
from __future__ import annotations

import argparse, json, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

try:
    import yaml
except Exception as exc:
    raise SystemExit('PyYAML is required: pip install pyyaml') from exc

ROOT=Path(__file__).resolve().parents[1]
STORY_CFG=ROOT/'story.yaml'
MEMORY=ROOT/'scripts'/'story-memory.py'

def fail(msg): print('MEMORY_LEDGER_HOLD:',msg,file=sys.stderr); raise SystemExit(2)
def load(path):
    if not path.exists(): fail(f'missing {path}')
    return yaml.safe_load(path.read_text(encoding='utf-8')) or {}
def ctx():
    sid=load(STORY_CFG).get('active_story')
    if not sid: fail('missing active_story')
    root=ROOT/'stories'/sid; return sid,root
def now(): return datetime.now(timezone.utc).isoformat()
def append(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('a',encoding='utf-8') as f: f.write(json.dumps(obj,ensure_ascii=False,sort_keys=True)+'\n')
def run(*args):
    cp=subprocess.run([sys.executable,str(MEMORY),*map(str,args)])
    if cp.returncode: raise SystemExit(cp.returncode)

def cmd_event(a):
    sid,root=ctx(); obj={'schema_version':1,'story_id':sid,'kind':'event','chapter':a.chapter,'event_type':a.type,'subject':a.subject,'field':a.field,'value':a.value,'world':a.world,'location':a.location,'source_path':a.source,'confidence':a.confidence,'status':'accepted','created_at':now()}
    if not a.source: fail('event provenance --source is required')
    append(root/'memory'/'events.jsonl',obj)
    args=['event','--chapter',a.chapter,'--type',a.type,'--source',a.source,'--confidence',a.confidence]
    for k,v in [('subject',a.subject),('field',a.field),('value',a.value),('world',a.world),('location',a.location)]:
        if v is not None: args += ['--'+k.replace('_','-'),v]
    run(*args)
def cmd_knowledge(a):
    sid,root=ctx()
    if not a.source: fail('knowledge provenance --source is required')
    obj={'schema_version':1,'story_id':sid,'kind':'knowledge','claim_id':a.claim_id,'layer':a.layer,'holder':a.holder,'value':a.value,'chapter':a.chapter,'certainty':a.certainty,'source_path':a.source,'status':'active','created_at':now()}
    append(root/'memory'/'knowledge.jsonl',obj)
    args=['knowledge','--claim-id',a.claim_id,'--layer',a.layer,'--value',a.value,'--chapter',a.chapter,'--certainty',a.certainty,'--source',a.source]
    if a.holder: args += ['--holder',a.holder]
    run(*args)
def cmd_edge(a):
    sid,root=ctx()
    if not a.source: fail('edge provenance --source is required')
    obj={'schema_version':1,'story_id':sid,'kind':'edge','from_node':a.from_node,'relation':a.relation,'to_node':a.to_node,'valid_from':a.chapter,'valid_to':a.valid_to,'source_path':a.source,'confidence':a.confidence,'created_at':now()}
    append(root/'memory'/'edges.jsonl',obj)
    args=['edge','--from-node',a.from_node,'--relation',a.relation,'--to-node',a.to_node,'--chapter',a.chapter,'--source',a.source,'--confidence',a.confidence]
    if a.valid_to is not None: args += ['--valid-to',a.valid_to]
    run(*args)
def cmd_thread(a):
    sid,root=ctx()
    if not a.source: fail('thread provenance --source is required')
    obj={'schema_version':1,'story_id':sid,'kind':'thread','thread_id':a.thread_id,'title':a.title,'status':a.status,'opened_chapter':a.opened_chapter,'updated_chapter':a.chapter,'resolved_chapter':a.resolved_chapter,'summary':a.summary,'source_path':a.source,'created_at':now()}
    append(root/'memory'/'threads.jsonl',obj)
    print('THREAD_LEDGER_OK')
def cmd_verify(a):
    sid,root=ctx(); errors=[]
    for name in ['events.jsonl','knowledge.jsonl','edges.jsonl','threads.jsonl']:
        p=root/'memory'/name
        if not p.exists(): continue
        for no,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
            if not line.strip(): continue
            try: obj=json.loads(line)
            except Exception as e: errors.append(f'{name}:{no}: invalid JSON: {e}'); continue
            if obj.get('story_id')!=sid: errors.append(f'{name}:{no}: story_id mismatch')
            if not obj.get('source_path'): errors.append(f'{name}:{no}: missing provenance')
    if errors:
        print('\n'.join(errors),file=sys.stderr); raise SystemExit(3)
    print('LEDGER_VERIFY_PASS')
def cmd_bootstrap(a):
    sid,root=ctx(); (root/'memory').mkdir(parents=True,exist_ok=True)
    for name in ['events.jsonl','knowledge.jsonl','edges.jsonl','threads.jsonl']:
        (root/'memory'/name).touch(exist_ok=True)
    run('init'); print('MEMORY_BOOTSTRAP_PASS')
def parser():
    p=argparse.ArgumentParser(); sp=p.add_subparsers(dest='cmd',required=True)
    s=sp.add_parser('bootstrap'); s.set_defaults(func=cmd_bootstrap)
    s=sp.add_parser('event'); s.add_argument('--chapter',type=int,required=True); s.add_argument('--type',required=True); s.add_argument('--subject'); s.add_argument('--field'); s.add_argument('--value'); s.add_argument('--world'); s.add_argument('--location'); s.add_argument('--source',required=True); s.add_argument('--confidence',type=float,default=1.0); s.set_defaults(func=cmd_event)
    s=sp.add_parser('knowledge'); s.add_argument('--claim-id',required=True); s.add_argument('--layer',required=True); s.add_argument('--holder'); s.add_argument('--value',required=True); s.add_argument('--chapter',type=int,required=True); s.add_argument('--certainty',type=float,default=1.0); s.add_argument('--source',required=True); s.set_defaults(func=cmd_knowledge)
    s=sp.add_parser('edge'); s.add_argument('--from-node',required=True); s.add_argument('--relation',required=True); s.add_argument('--to-node',required=True); s.add_argument('--chapter',type=int,required=True); s.add_argument('--valid-to',type=int); s.add_argument('--source',required=True); s.add_argument('--confidence',type=float,default=1.0); s.set_defaults(func=cmd_edge)
    s=sp.add_parser('thread'); s.add_argument('--thread-id',required=True); s.add_argument('--title',required=True); s.add_argument('--status',default='open'); s.add_argument('--opened-chapter',type=int,required=True); s.add_argument('--chapter',type=int,required=True); s.add_argument('--resolved-chapter',type=int); s.add_argument('--summary'); s.add_argument('--source',required=True); s.set_defaults(func=cmd_thread)
    s=sp.add_parser('verify'); s.set_defaults(func=cmd_verify)
    return p
if __name__=='__main__':
    a=parser().parse_args(); a.func(a)
