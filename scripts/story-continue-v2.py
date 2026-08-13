#!/usr/bin/env python3
from __future__ import annotations
import argparse, subprocess, sys
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]

def run(cmd):
    r=subprocess.run(cmd,cwd=ROOT)
    if r.returncode: raise SystemExit(r.returncode)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--count',type=int,choices=[5,10],required=True); ap.add_argument('--query',default='continue current arc according to canon and accepted history'); ap.add_argument('--entity',action='append'); a=ap.parse_args()
    cfg=yaml.safe_load((ROOT/'story.yaml').read_text(encoding='utf-8')) or {}; sid=cfg.get('active_story')
    if not sid: raise SystemExit('active_story missing')
    sroot=ROOT/'stories'/sid; man=yaml.safe_load((sroot/'manifest.yaml').read_text(encoding='utf-8')) or {}; nxt=int(man.get('next_chapter',1))
    run([sys.executable,str(ROOT/'scripts'/'adaptive-audit-gate.py')])
    run([sys.executable,str(ROOT/'scripts'/'story-memory.py'),'init'])
    ctx=sroot/'.work'/f'writer-context-ch{nxt:04d}.md'
    cmd=[sys.executable,str(ROOT/'scripts'/'intent-context-v2.py'),'--target-chapter',str(nxt),'--query',a.query,'--output',str(ctx)]
    for e in a.entity or []: cmd += ['--entity',e]
    run(cmd)
    run([sys.executable,str(ROOT/'scripts'/'storyctl.py'),'begin','--count',str(a.count)])
    print(f'STORY_BATCH_READY: {sid} ch{nxt:04d}-ch{nxt+a.count-1:04d}')
    print(f'WRITER_CONTEXT: {ctx}')
    print('REQUIRED: prewrite must cite CANON/INTENT and ACCEPTED_HISTORY separately.')

if __name__=='__main__': main()
