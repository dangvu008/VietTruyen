#!/usr/bin/env python3
from __future__ import annotations
import argparse, subprocess, sys
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]

def hold(m,c=2): print('INTENT_CONTEXT_HOLD:',m,file=sys.stderr); raise SystemExit(c)
def y(p):
    if not p.exists(): hold(f'missing {p}')
    return yaml.safe_load(p.read_text(encoding='utf-8')) or {}

def resolve():
    cfg=y(ROOT/'story.yaml'); sid=cfg.get('active_story')
    if not sid: hold('active_story missing')
    s=ROOT/'stories'/sid; return sid,s,y(s/'manifest.yaml')

def section(p,label,required=True):
    if not p.exists():
        if required: hold(f'missing required intent file {p}')
        return f'## {label}\n\n> not configured\n'
    return f'## {label}\nSource: `{p.relative_to(ROOT)}`\n\n{p.read_text(encoding="utf-8").strip()}\n'

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--target-chapter',type=int); ap.add_argument('--query',required=True); ap.add_argument('--entity',action='append'); ap.add_argument('--output',required=True); a=ap.parse_args()
    sid,s,man=resolve(); target=a.target_chapter or int(man.get('next_chapter',1))
    arc=s/'planning'/'arc-001.yaml' if man.get('current_arc','ARC01')=='ARC01' else s/'planning'/f"{str(man.get('current_arc')).lower()}.yaml"
    intent='\n'.join([
      '# STORY INTENT CONTEXT',
      '> Intent constrains direction; it does not prove that an event happened.',
      section(s/'canon'/'authority-model.yaml','Authority model'),
      section(s/'canon'/'10-hard-constraints.yaml','Hard constraints'),
      section(s/'canon'/'03-dream-world.yaml','Dream-world canon'),
      section(s/'canon'/'story-framework.md','Story framework'),
      section(s/'planning'/'unresolved.yaml','Unknown / forbidden answers'),
      section(arc,'Current arc intent'),
      '## Intent guard\n- CANON constrains.\n- ACCEPTED_HISTORY proves past events.\n- PLANNED is future intent only.\n- PROPOSED is optional.\n- UNKNOWN may not be invented.\n- Real/Dream similarity defaults to UNCONFIRMED_RELATION.'
    ])
    out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True); hist=out.with_suffix('.history.md')
    cmd=[sys.executable,str(ROOT/'scripts'/'story-memory.py'),'retrieve','--target-chapter',str(target),'--query',a.query,'--output',str(hist)]
    for e in a.entity or []: cmd += ['--entity',e]
    r=subprocess.run(cmd,cwd=ROOT)
    if r.returncode: hold('history retrieval failed',r.returncode)
    history=hist.read_text(encoding='utf-8') if hist.exists() else '# MEMORY CONTEXT\n> empty'
    text='\n\n'.join([f'# WRITER CONTEXT — {sid} → ch{target}','## Authority boundary\nNever merge future intent with accepted history.',intent,history,'## Mandatory prewrite fields\n- relevant CANON constraints\n- accepted-history evidence with provenance\n- current PLANNED beat\n- UNKNOWN/forbidden reveals\n- insufficient evidence / HOLD points'])
    out.write_text(text,encoding='utf-8')
    if hist.exists(): hist.unlink()
    print(out)

if __name__=='__main__': main()
