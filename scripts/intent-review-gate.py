#!/usr/bin/env python3
from __future__ import annotations
import argparse, sys
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
PASS='PASS'
REQUIRED=['canon_constraints_respected','accepted_history_consistent','planned_not_treated_as_happened','unknown_not_invented','cross_world_not_overclaimed']

def load(p):
    if not p.exists():
        print(f'INTENT_REVIEW_HOLD: missing {p}',file=sys.stderr); raise SystemExit(4)
    return yaml.safe_load(p.read_text(encoding='utf-8')) or {}

def story_root():
    cfg=load(ROOT/'story.yaml'); sid=cfg.get('active_story')
    if not sid: print('INTENT_REVIEW_HOLD: active_story missing',file=sys.stderr); raise SystemExit(4)
    return ROOT/'stories'/sid

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--batch',required=True); a=ap.parse_args()
    broot=story_root()/'.work'/a.batch
    receipt=broot/'receipts'/'intent-review.yaml'; data=load(receipt)
    if data.get('status')!=PASS:
        print('INTENT_REVIEW_HOLD: receipt status is not PASS',file=sys.stderr); raise SystemExit(4)
    checks=data.get('checks',{}); bad=[x for x in REQUIRED if checks.get(x)!=PASS]
    if bad:
        print('INTENT_REVIEW_HOLD: missing PASS: '+', '.join(bad),file=sys.stderr); raise SystemExit(4)
    ev=data.get('evidence',{})
    if not ev.get('canon') or not ev.get('history'):
        print('INTENT_REVIEW_HOLD: canon/history evidence required',file=sys.stderr); raise SystemExit(4)
    print('INTENT_REVIEW_PASS')

if __name__=='__main__': main()
