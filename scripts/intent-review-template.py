#!/usr/bin/env python3
from pathlib import Path
import argparse, yaml
ROOT=Path(__file__).resolve().parents[1]

def main():
    p=argparse.ArgumentParser(); p.add_argument('--batch',required=True); a=p.parse_args()
    cfg=yaml.safe_load((ROOT/'story.yaml').read_text(encoding='utf-8')) or {}; sid=cfg['active_story']
    out=ROOT/'stories'/sid/'.work'/a.batch/'receipts'/'intent-review.yaml'; out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists(): print(out); return
    data={'schema_version':1,'status':'PENDING','checks':{k:'PENDING' for k in ['canon_constraints_respected','accepted_history_consistent','planned_not_treated_as_happened','unknown_not_invented','cross_world_not_overclaimed']},'evidence':{'canon':[],'history':[]},'planned_beat':None,'unknowns_touched':[],'exceptions':[]}
    out.write_text(yaml.safe_dump(data,allow_unicode=True,sort_keys=False),encoding='utf-8'); print(out)
if __name__=='__main__': main()
