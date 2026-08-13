#!/usr/bin/env python3
from __future__ import annotations
import argparse, subprocess, sys
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]

def hold(m,c=2): print('INTENT_CONTEXT_HOLD:',m,file=sys.stderr); raise SystemExit(c)
def load(p):
    if not p.exists(): hold(f'missing {p}')
    return yaml.safe_load(p.read_text(encoding='utf-8')) or {}
def resolve():
    cfg=load(ROOT/'story.yaml'); sid=cfg.get('active_story')
    if not sid: hold('active_story missing')
    s=ROOT/'stories'/sid; return sid,s,load(s/'manifest.yaml')
def sec(p): return f"### {p.name}\nSource: `{p.relative_to(ROOT)}`\n\n{p.read_text(encoding='utf-8').strip()}\n"
def canon_sections(s):
    files=sorted([p for p in (s/'canon').iterdir() if p.is_file() and p.suffix.lower() in {'.md','.yaml','.yml'}])
    if not files: hold('canon directory has no readable files')
    return '\n'.join(sec(p) for p in files)
def planning_sections(s,man):
    files=[]; unresolved=s/'planning'/'unresolved.yaml'
    if unresolved.exists(): files.append(unresolved)
    arcid=str(man.get('current_arc','ARC01'))
    arc=s/'planning'/'arc-001.yaml' if arcid=='ARC01' else s/'planning'/f'{arcid.lower()}.yaml'
    if not arc.exists(): hold(f'current arc file missing: {arc}')
    files.append(arc)
    return '\n'.join(sec(p) for p in files)
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--target-chapter',type=int); ap.add_argument('--query',required=True); ap.add_argument('--entity',action='append'); ap.add_argument('--output',required=True); a=ap.parse_args()
    sid,s,man=resolve(); target=a.target_chapter or int(man.get('next_chapter',1)); out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True)
    hist=out.with_suffix('.history.md'); cmd=[sys.executable,str(ROOT/'scripts'/'story-memory.py'),'retrieve','--target-chapter',str(target),'--query',a.query,'--output',str(hist)]
    for e in a.entity or []: cmd += ['--entity',e]
    r=subprocess.run(cmd,cwd=ROOT)
    if r.returncode: hold('history retrieval failed',r.returncode)
    history=hist.read_text(encoding='utf-8') if hist.exists() else '# HISTORY\n> empty'
    text='\n\n'.join([
      f'# WRITER CONTEXT — {sid} → ch{target}',
      '## Authority boundary\nCANON constrains. ACCEPTED_HISTORY proves past events. PLANNED is future intent only. UNKNOWN must remain unresolved.',
      '## STORY BIBLE / CANON\n'+canon_sections(s),
      '## ALLOWED PLANNING CONTEXT\n'+planning_sections(s,man),
      '## ACCEPTED HISTORY / MEMORY\n'+history,
      '## Mandatory prewrite\nList separately: CANON constraints; accepted-history evidence with provenance; current planned beat; UNKNOWN/forbidden reveals; insufficient evidence. Never merge these categories.'
    ])
    out.write_text(text,encoding='utf-8');
    if hist.exists(): hist.unlink()
    print(out)
if __name__=='__main__': main()
