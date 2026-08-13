#!/usr/bin/env python3
from __future__ import annotations
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def main():
    if len(sys.argv) < 2:
        return subprocess.call([sys.executable, str(ROOT/'scripts/storyctl.py')])
    command = sys.argv[1]
    batch = None
    if '--batch' in sys.argv:
        i = sys.argv.index('--batch')
        if i + 1 < len(sys.argv): batch = sys.argv[i+1]
    if command in {'gate','commit'}:
        if not batch:
            print('STORY_OS_HOLD: --batch is required by storyctl-safe for gate/commit', file=sys.stderr)
            return 3
        rc = subprocess.call([sys.executable, str(ROOT/'scripts/narrative-quality-gate.py'), 'check', '--batch', batch])
        if rc != 0:
            print('STORY_OS_HOLD: narrative quality gate did not PASS', file=sys.stderr)
            return rc
    return subprocess.call([sys.executable, str(ROOT/'scripts/storyctl.py'), *sys.argv[1:]])

if __name__ == '__main__':
    raise SystemExit(main())
