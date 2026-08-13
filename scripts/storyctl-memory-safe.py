#!/usr/bin/env python3
from __future__ import annotations

import argparse, subprocess, sys
from pathlib import Path

try:
    import yaml
except Exception as exc:
    raise SystemExit('PyYAML is required: pip install pyyaml') from exc

ROOT=Path(__file__).resolve().parents[1]
STORYCTL=ROOT/'scripts'/'storyctl.py'
STORY_CFG=ROOT/'story.yaml'
PASS='PASS'

REQUIRED_MEMORY_CHECKS=[
    'expected_deltas_extracted',
    'accepted_evidence_only',
    'knowledge_layers_preserved',
    'timeline_updates_complete',
    'open_threads_synced',
    'graph_edges_provenanced',
    'state_projection_matches_events',
    'durable_ledgers_verified',
    'retrieval_context_generated',
    'cold_memory_policy_respected',
]

def fail(msg): print('STORY_MEMORY_SAFE_HOLD:',msg,file=sys.stderr); raise SystemExit(4)
def load(path):
    if not path.exists(): fail(f'missing {path}')
    return yaml.safe_load(path.read_text(encoding='utf-8')) or {}
def story_root():
    sid=load(STORY_CFG).get('active_story')
    if not sid: fail('story.yaml missing active_story')
    return ROOT/'stories'/sid

def open_batch(root,name=None):
    work=root/'.work'
    if name:
        p=work/name
        if not p.exists(): fail(f'batch not found: {name}')
        return p
    batches=[]
    if work.exists():
        for p in work.iterdir():
            if p.is_dir() and (p/'batch.yaml').exists() and load(p/'batch.yaml').get('status')=='OPEN': batches.append(p)
    if len(batches)!=1: fail(f'expected one OPEN batch, found {len(batches)}')
    return batches[0]

def verify_memory(broot):
    receipt=broot/'receipts'/'memory-connectivity.yaml'
    data=load(receipt)
    if data.get('status')!=PASS: fail(f'memory receipt status={data.get("status")!r}')
    checks=data.get('checks',{})
    missing=[x for x in REQUIRED_MEMORY_CHECKS if checks.get(x)!=PASS]
    if missing: fail('memory receipt missing PASS: '+', '.join(missing))
    evidence=data.get('evidence') or []
    if not evidence: fail('memory receipt requires evidence/provenance entries')

def main():
    p=argparse.ArgumentParser(add_help=False); p.add_argument('command',nargs='?'); p.add_argument('--batch'); args,rest=p.parse_known_args()
    if args.command in {'gate','commit'}:
        broot=open_batch(story_root(),args.batch); verify_memory(broot)
    cmd=[sys.executable,str(STORYCTL)]
    if args.command: cmd.append(args.command)
    if args.batch: cmd += ['--batch',args.batch]
    cmd += rest
    raise SystemExit(subprocess.run(cmd).returncode)

if __name__=='__main__': main()
