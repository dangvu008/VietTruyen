#!/usr/bin/env python3
from __future__ import annotations
import subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def call(script,*args):
    return subprocess.call([sys.executable,str(ROOT/'scripts'/script),*args],cwd=ROOT)

def batch_arg(argv):
    if '--batch' not in argv: return None
    i=argv.index('--batch'); return argv[i+1] if i+1<len(argv) else None

def main():
    if len(sys.argv)<2: return call('storyctl.py')
    command=sys.argv[1]; batch=batch_arg(sys.argv)
    if command in {'gate','commit'}:
        if not batch:
            print('STORY_OS_HOLD: --batch required',file=sys.stderr); return 4
        for script,args in [
            ('narrative-quality-gate.py',['check','--batch',batch]),
            ('intent-review-gate.py',['--batch',batch]),
        ]:
            rc=call(script,*args)
            if rc: return rc
        rc=call('storyctl-memory-safe.py',command,'--batch',batch,*[x for x in sys.argv[2:] if x not in {'--batch',batch}])
        return rc
    return call('storyctl.py',*sys.argv[1:])

if __name__=='__main__': raise SystemExit(main())
