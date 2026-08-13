#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "config" / "story-os" / "milestone-audit-policy.yaml"
STORY_CFG = ROOT / "story.yaml"
PASS = "PASS"


def load(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"STORY_OS_HOLD: missing {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def audit_path(sroot: Path, chapter: int) -> Path:
    return sroot / "audits" / f"memory-{chapter:04d}.yaml"


def band_for(chapter: int, policy: dict):
    for band in policy.get("audit_schedule", {}).get("bands", []):
        lo = int(band.get("min_chapter", 1))
        hi = band.get("max_chapter")
        if chapter >= lo and (hi is None or chapter <= int(hi)):
            return band
    return None


def latest_health(sroot: Path, through: int):
    receipts = sorted(sroot.joinpath("audits").glob("memory-*.yaml"), reverse=True)
    for path in receipts:
        data = load(path)
        ch = int(data.get("through_chapter", 0))
        if ch <= through and data.get("status") == PASS:
            value = data.get("metrics", {}).get("overall")
            if value is not None:
                return float(value), path
    return None, None


def effective_interval(chapter: int, policy: dict, sroot: Path):
    band = band_for(chapter, policy)
    if not band:
        return None, None
    interval = int(band["interval"])
    health, _ = latest_health(sroot, chapter)
    hp = policy.get("health_policy", {})
    if health is not None and health < float(hp.get("normal_min", 0.95)):
        if health < float(hp.get("degraded_min", 0.90)):
            return 0, band
        multiplier = float(hp.get("degraded_interval_multiplier", 0.5))
        interval = max(5, int(round(interval * multiplier)))
    return interval, band


def due_kind(chapter: int, policy: dict, sroot: Path):
    if chapter <= 0:
        return None

    hp = policy.get("health_policy", {})
    health, health_path = latest_health(sroot, chapter)
    if health is not None and health < float(hp.get("degraded_min", 0.90)):
        return {
            "name": "memory_health_rebuild",
            "reason": f"memory_health={health:.3f} below degraded_min",
            "receipt": health_path,
            "checks_key": "deep_integrity_audit",
        }

    deep = policy.get("audit_schedule", {}).get("deep_integrity", {})
    start = int(deep.get("start_chapter", 1000))
    step = int(deep.get("interval", 500))
    if chapter >= start and (chapter - start) % step == 0:
        return {
            "name": deep.get("name", "deep_integrity_audit"),
            "reason": f"deep integrity milestone every {step} chapters",
            "checks_key": "deep_integrity_audit",
        }

    interval, band = effective_interval(chapter, policy, sroot)
    if interval == 0:
        return {
            "name": "memory_health_rebuild",
            "reason": "memory health requires HOLD/rebuild",
            "checks_key": "deep_integrity_audit",
        }
    if interval and chapter % interval == 0:
        return {
            "name": band.get("name", "long_horizon_memory_audit"),
            "reason": f"adaptive interval={interval}",
            "checks_key": band.get("name", "long_horizon_memory_audit"),
        }

    drift = int(policy.get("audit_schedule", {}).get("drift_interval", 25))
    if chapter % drift == 0:
        return {
            "name": "drift_audit",
            "reason": f"drift interval={drift}",
            "checks_key": "drift_audit",
        }
    return None


def main() -> int:
    cfg = load(STORY_CFG)
    sid = cfg["active_story"]
    sroot = ROOT / "stories" / sid
    manifest = load(sroot / "manifest.yaml")
    policy = load(POLICY)
    latest = int(manifest.get("latest_accepted_chapter", 0))
    due = due_kind(latest, policy, sroot)

    print(f"story_id={sid}")
    print(f"latest_accepted={latest}")
    if not due:
        interval, _ = effective_interval(max(1, latest + 1), policy, sroot)
        health, _ = latest_health(sroot, latest)
        print("adaptive_audit_due=none")
        print(f"effective_major_interval={interval}")
        print(f"memory_health={health if health is not None else 'unknown'}")
        return 0

    receipt = audit_path(sroot, latest)
    print(f"adaptive_audit_due={due['name']}")
    print(f"reason={due['reason']}")
    print(f"receipt={receipt.relative_to(ROOT)}")
    if not receipt.exists():
        print("ADAPTIVE_AUDIT_GATE=HOLD")
        return 3
    data = load(receipt)
    if data.get("status") != PASS:
        print(f"ADAPTIVE_AUDIT_GATE=HOLD status={data.get('status')!r}")
        return 3

    health = data.get("metrics", {}).get("overall")
    hp = policy.get("health_policy", {})
    if health is not None and float(health) < float(hp.get("degraded_min", 0.90)):
        print(f"ADAPTIVE_AUDIT_GATE=HOLD memory_health={health}")
        return 3

    print("ADAPTIVE_AUDIT_GATE=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
