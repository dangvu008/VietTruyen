#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except Exception as exc:
    raise SystemExit('PyYAML is required: pip install pyyaml') from exc

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    p = subprocess.run(args, cwd=ROOT)
    if p.returncode != 0:
        raise SystemExit(p.returncode)


def main():
    ap = argparse.ArgumentParser(prog='story-continue')
    ap.add_argument('--count', type=int, choices=[5, 10], required=True)
    ap.add_argument('--query', default='continue current arc according to canon and accepted history')
    ap.add_argument('--entity', action='append')
    a = ap.parse_args()

    cfg = yaml.safe_load((ROOT / 'story.yaml').read_text(encoding='utf-8')) or {}
    sid = cfg.get('active_story')
    if not sid:
        raise SystemExit('active_story missing')
    sroot = ROOT / 'stories' / sid
    man = yaml.safe_load((sroot / 'manifest.yaml').read_text(encoding='utf-8')) or {}
    next_ch = int(man.get('next_chapter', 1))

    run([sys.executable, str(ROOT/'scripts'/'adaptive-audit-gate.py')])
    run([sys.executable, str(ROOT/'scripts'/'story-memory.py'), 'init'])

    ctx = sroot / '.work' / f'writer-context-ch{next_ch:04d}.md'
    cmd = [sys.executable, str(ROOT/'scripts'/'intent-context.py'), '--target-chapter', str(next_ch), '--query', a.query, '--output', str(ctx)]
    for e in a.entity or []:
        cmd += ['--entity', e]
    run(cmd)

    run([sys.executable, str(ROOT/'scripts'/'storyctl.py'), 'begin', '--count', str(a.count)])
    print(f'STORY_BATCH_READY: {sid} ch{next_ch:04d}-ch{next_ch+a.count-1:04d}')
    print(f'WRITER_CONTEXT: {ctx}')
    print('NEXT: create prewrite contracts from WRITER_CONTEXT before drafting.')


if __name__ == '__main__':
    main()
