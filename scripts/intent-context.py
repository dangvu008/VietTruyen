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
STORY_CFG = ROOT / 'story.yaml'


def fail(msg: str, code: int = 2):
    print(f'INTENT_CONTEXT_HOLD: {msg}', file=sys.stderr)
    raise SystemExit(code)


def load_yaml(path: Path):
    if not path.exists():
        fail(f'missing required file: {path}')
    return yaml.safe_load(path.read_text(encoding='utf-8')) or {}


def resolve_story():
    cfg = load_yaml(STORY_CFG)
    sid = cfg.get('active_story')
    if not sid:
        fail('story.yaml missing active_story')
    sroot = ROOT / 'stories' / sid
    manifest = load_yaml(sroot / 'manifest.yaml')
    return sid, sroot, manifest


def read_if_exists(path: Path, label: str):
    if not path.exists():
        return f'## {label}\n\n> MISSING / HOLD if required by current chapter.\n'
    return f'## {label}\n\nSource: `{path.relative_to(ROOT)}`\n\n{path.read_text(encoding="utf-8").strip()}\n'


def build_intent(sroot: Path, manifest: dict):
    arc = str(manifest.get('current_arc', 'ARC01')).lower().replace('arc', 'arc-')
    if arc == 'arc-01':
        arc_file = sroot / 'planning' / 'arc-001.yaml'
    else:
        arc_file = sroot / 'planning' / f'{arc}.yaml'
    files = [
        (sroot / 'canon' / 'authority-model.yaml', 'Authority model'),
        (sroot / 'canon' / '10-hard-constraints.yaml', 'Hard constraints'),
        (sroot / 'canon' / '03-dream-world.yaml', 'Dream-world canon'),
        (sroot / 'canon' / 'story-framework.md', 'Story framework'),
        (arc_file, 'Current arc intent'),
    ]
    out = ['# STORY INTENT CONTEXT', '',
           '> Intent is not history. PLANNED/PROPOSED/UNKNOWN must never be narrated as already happened.', '']
    for path, label in files:
        out.append(read_if_exists(path, label))
    out += ['## Intent guard',
            '- CANON constrains the draft.',
            '- ACCEPTED_HISTORY proves what happened.',
            '- PLANNED describes intended future only.',
            '- PROPOSED is optional and not authoritative.',
            '- UNKNOWN is intentionally unresolved; do not invent an answer.',
            '- Similarity across Real/Dream defaults to UNCONFIRMED_RELATION.']
    return '\n'.join(out)


def cmd_build(a):
    sid, sroot, manifest = resolve_story()
    target = a.target_chapter or int(manifest.get('next_chapter', 1))
    outpath = Path(a.output) if a.output else sroot / '.work' / f'context-ch{target:04d}.md'
    outpath.parent.mkdir(parents=True, exist_ok=True)

    history = outpath.with_suffix('.history.md')
    cmd = [sys.executable, str(ROOT / 'scripts' / 'story-memory.py'), 'retrieve',
           '--target-chapter', str(target), '--query', a.query, '--output', str(history)]
    for entity in a.entity or []:
        cmd += ['--entity', entity]
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        fail('history retrieval failed', result.returncode)

    intent = build_intent(sroot, manifest)
    history_text = history.read_text(encoding='utf-8') if history.exists() else '# MEMORY CONTEXT\n\n> empty\n'
    combined = '\n'.join([
        f'# WRITER CONTEXT — {sid} → ch{target}',
        '',
        '## Authority boundary',
        'Use CANON/INTENT to constrain direction. Use ACCEPTED HISTORY to prove past events. Never merge them.',
        '', intent, '', history_text,
        '', '## Prewrite requirement',
        'Before drafting, explicitly list: relevant CANON constraints, relevant ACCEPTED_HISTORY evidence, current PLANNED beat, UNKNOWN/forbidden reveals, and any insufficient evidence.',
    ])
    outpath.write_text(combined, encoding='utf-8')
    try:
        history.unlink()
    except OSError:
        pass
    print(outpath)


def parser():
    p = argparse.ArgumentParser(prog='intent-context')
    p.add_argument('--target-chapter', type=int)
    p.add_argument('--query', required=True)
    p.add_argument('--entity', action='append')
    p.add_argument('--output')
    p.set_defaults(func=cmd_build)
    return p


if __name__ == '__main__':
    args = parser().parse_args()
    args.func(args)
