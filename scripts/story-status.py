#!/usr/bin/env python3
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
story_cfg = yaml.safe_load((ROOT/'story.yaml').read_text(encoding='utf-8'))
sid = story_cfg['active_story']
sroot = ROOT/'stories'/sid
manifest = yaml.safe_load((sroot/'manifest.yaml').read_text(encoding='utf-8'))
latest = int(manifest.get('latest_accepted_chapter', 0))
default_batch = int(story_cfg['story_os'].get('default_batch_size', 5))

print(f'story_id={sid}')
print(f"title={manifest.get('title')}")
print(f'latest_accepted={latest}')
print(f'next_chapter={latest+1}')
print(f'default_batch={default_batch}')
print(f'default_range={latest+1}-{latest+default_batch}')

for m in [1000, 500, 100, 25]:
    if latest and latest % m == 0:
        receipt = sroot/'audits'/f'memory-{latest:04d}.yaml'
        print(f'milestone_due={m}')
        print(f"milestone_receipt={'present' if receipt.exists() else 'MISSING'}")
        break
