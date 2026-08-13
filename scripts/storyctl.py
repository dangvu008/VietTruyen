#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except Exception as exc:
    raise SystemExit("PyYAML is required: pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[1]
STORY_CFG = ROOT / "story.yaml"
BATCH_POLICY = ROOT / "config" / "story-os" / "batch-policy.yaml"
MILESTONE_POLICY = ROOT / "config" / "story-os" / "milestone-audit-policy.yaml"
PASS = "PASS"


def fail(message: str, code: int = 2) -> None:
    print(f"STORY_OS_HOLD: {message}", file=sys.stderr)
    raise SystemExit(code)


def load_yaml(path: Path) -> dict:
    if not path.exists():
        fail(f"Missing required file: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def dump_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_story():
    cfg = load_yaml(STORY_CFG)
    sid = cfg.get("active_story")
    if not sid:
        fail("story.yaml does not define active_story")
    sroot = ROOT / "stories" / sid
    manifest = load_yaml(sroot / "manifest.yaml")
    if manifest.get("story_id") != sid:
        fail(f"Manifest story_id mismatch: expected {sid}")
    return cfg, sid, sroot, manifest


def latest_accepted(manifest: dict) -> int:
    return int(manifest.get("latest_accepted_chapter", 0))


def milestone_due(chapter: int, policy: dict):
    if chapter <= 0:
        return None
    milestones = sorted((int(k) for k in policy.get("milestones", {}).keys()), reverse=True)
    for milestone in milestones:
        if chapter % milestone == 0:
            return milestone
    return None


def audit_receipt_path(sroot: Path, chapter: int) -> Path:
    return sroot / "audits" / f"memory-{chapter:04d}.yaml"


def require_prior_milestone_clear(sroot: Path, manifest: dict, policy: dict) -> None:
    latest = latest_accepted(manifest)
    due = milestone_due(latest, policy)
    if due is None:
        return
    receipt = audit_receipt_path(sroot, latest)
    if not receipt.exists():
        fail(f"Milestone audit {due} due at chapter {latest}; missing {receipt.relative_to(ROOT)}")
    status = load_yaml(receipt).get("status")
    if status != PASS:
        fail(f"Milestone audit {due} at chapter {latest} is not PASS (status={status!r})")


def active_work_dirs(sroot: Path):
    work = sroot / ".work"
    if not work.exists():
        return []
    return sorted([p for p in work.iterdir() if p.is_dir() and p.name.startswith("batch-")])


def batch_name(start: int, end: int) -> str:
    return f"batch-{start:04d}-{end:04d}"


def batch_root(sroot: Path, start: int, end: int) -> Path:
    return sroot / ".work" / batch_name(start, end)


def batch_meta_path(broot: Path) -> Path:
    return broot / "batch.yaml"


def chapter_dir(broot: Path, chapter: int) -> Path:
    return broot / "chapters" / f"ch{chapter:04d}"


def ensure_no_overlap(sroot: Path, start: int, end: int) -> None:
    for path in active_work_dirs(sroot):
        meta = batch_meta_path(path)
        if not meta.exists():
            continue
        data = load_yaml(meta)
        if data.get("status") in ("COMMITTED", "ABORTED"):
            continue
        a, b = int(data.get("start", -1)), int(data.get("end", -1))
        if max(a, start) <= min(b, end):
            fail(f"Active batch overlaps requested range: {path.name} ({a}-{b})")


def chapter_receipt_template(chapter: int) -> dict:
    return {
        "schema_version": 1,
        "chapter": chapter,
        "status": "PENDING",
        "stages": {
            "prewrite_contract": "PENDING",
            "draft": "PENDING",
            "deterministic_checks": "PENDING",
            "editorial_review": "PENDING",
            "edit": "PENDING",
            "re_review": "PENDING",
            "chapter_candidate": "PENDING",
            "extract_temp_delta": "PENDING",
        },
        "gates": {
            "canon_consistency": "PENDING",
            "timeline_continuity": "PENDING",
            "knowledge_boundary": "PENDING",
            "character_state": "PENDING",
            "inventory_and_resources": "PENDING",
            "power_progression": "PENDING",
            "prose_flow": "PENDING",
            "paragraph_fragmentation": "PENDING",
            "reader_orientation": "PENDING",
            "dream_continuity": "PENDING",
            "main_fallibility": "PENDING",
        },
        "evidence": [],
        "updated_at": now_iso(),
    }


def required_stages(policy: dict):
    return [x for x in policy.get("chapter_pipeline", []) if x != "load_context"]


def required_gates(policy: dict):
    return list(policy.get("chapter_gates", []))


def validate_chapter_receipt(path: Path, policy: dict):
    if not path.exists():
        return [f"missing receipt: {path}"]
    data = load_yaml(path)
    errors = []
    if data.get("status") != PASS:
        errors.append(f"chapter receipt status={data.get('status')!r}, expected PASS")
    for name in required_stages(policy):
        if data.get("stages", {}).get(name) != PASS:
            errors.append(f"stage {name} != PASS")
    for name in required_gates(policy):
        if data.get("gates", {}).get(name) != PASS:
            errors.append(f"gate {name} != PASS")
    return errors


def required_batch_checks(policy: dict, count: int):
    if count <= 5:
        return [x for x in policy.get("batch_5_pipeline", []) if x not in ("atomic_accept", "checkpoint")]
    return [
        "mini_batch_review_first_5", "mini_batch_review_second_5", "full_10_chapter_review",
        "cross_chapter_continuity", "causality_audit", "character_trajectory_audit",
        "arc_progress_audit", "mystery_management_audit", "repetition_and_motif_audit",
        "prose_style_audit", "memory_connectivity_audit", "regression_review",
    ]


def validate_batch_receipt(broot: Path, count: int, policy: dict):
    path = broot / "receipts" / "batch-review.yaml"
    if not path.exists():
        return [f"missing batch review receipt: {path}"]
    data = load_yaml(path)
    errors = []
    if data.get("status") != PASS:
        errors.append(f"batch review status={data.get('status')!r}, expected PASS")
    for name in required_batch_checks(policy, count):
        if data.get("checks", {}).get(name) != PASS:
            errors.append(f"batch check {name} != PASS")
    return errors


def validate_memory_receipt(broot: Path):
    path = broot / "receipts" / "memory-connectivity.yaml"
    if not path.exists():
        return [f"missing memory connectivity receipt: {path}"]
    data = load_yaml(path)
    errors = []
    if data.get("status") != PASS:
        errors.append(f"memory connectivity status={data.get('status')!r}, expected PASS")
    for name in [
        "expected_deltas_extracted", "accepted_evidence_only", "knowledge_layers_preserved",
        "timeline_updates_complete", "open_threads_synced", "graph_edges_provenanced",
        "state_projection_matches_events",
    ]:
        if data.get("checks", {}).get(name) != PASS:
            errors.append(f"memory check {name} != PASS")
    return errors


def ensure_candidate_files(broot: Path, start: int, end: int):
    errors = []
    for chapter in range(start, end + 1):
        cdir = chapter_dir(broot, chapter)
        candidate = cdir / "candidate.md"
        delta = cdir / "temp-delta.yaml"
        if not candidate.exists() or candidate.stat().st_size == 0:
            errors.append(f"ch{chapter:04d}: missing/non-empty candidate.md")
        if not delta.exists():
            errors.append(f"ch{chapter:04d}: missing temp-delta.yaml")
        else:
            status = load_yaml(delta).get("status")
            if status != PASS:
                errors.append(f"ch{chapter:04d}: temp-delta status={status!r}, expected PASS")
    return errors


def locate_batch(sroot: Path, name):
    if name:
        path = sroot / ".work" / name
        if not path.exists():
            fail(f"Batch not found: {name}")
        return path
    active = [p for p in active_work_dirs(sroot) if load_yaml(batch_meta_path(p)).get("status") == "OPEN"]
    if len(active) != 1:
        fail(f"Expected exactly one OPEN batch, found {len(active)}; pass --batch")
    return active[0]


def collect_gate_errors(broot: Path, policy: dict):
    meta = load_yaml(batch_meta_path(broot))
    start, end, count = int(meta["start"]), int(meta["end"]), int(meta["count"])
    errors = ensure_candidate_files(broot, start, end)
    for chapter in range(start, end + 1):
        chapter_errors = validate_chapter_receipt(chapter_dir(broot, chapter) / "receipt.yaml", policy)
        errors += [f"ch{chapter:04d}: {item}" for item in chapter_errors]
    errors += validate_batch_receipt(broot, count, policy)
    errors += validate_memory_receipt(broot)
    return errors


def cmd_status(_args):
    cfg, sid, sroot, manifest = resolve_story()
    policy = load_yaml(MILESTONE_POLICY)
    latest = latest_accepted(manifest)
    due = milestone_due(latest, policy)
    print(f"story_id={sid}")
    print(f"title={manifest.get('title')}")
    print(f"latest_accepted={latest}")
    print(f"next_chapter={latest + 1}")
    print(f"default_batch_size={cfg.get('story_os', {}).get('default_batch_size', 5)}")
    if due:
        receipt = audit_receipt_path(sroot, latest)
        status = load_yaml(receipt).get("status") if receipt.exists() else "MISSING"
        print(f"milestone_due={due}")
        print(f"milestone_status={status}")
    else:
        print("milestone_due=none")
    active = active_work_dirs(sroot)
    print("active_batches=" + (",".join(p.name for p in active) if active else "none"))


def cmd_begin(args):
    cfg, sid, sroot, manifest = resolve_story()
    batch_policy = load_yaml(BATCH_POLICY)
    milestone_policy = load_yaml(MILESTONE_POLICY)
    require_prior_milestone_clear(sroot, manifest, milestone_policy)
    count = args.count or int(cfg.get("story_os", {}).get("default_batch_size", 5))
    max_batch = int(cfg.get("story_os", {}).get("max_batch_size", 10))
    if count not in (5, 10):
        fail("Only batch sizes 5 or 10 are allowed")
    if count > max_batch:
        fail(f"Requested batch {count} exceeds max_batch_size={max_batch}")
    start = latest_accepted(manifest) + 1
    end = start + count - 1
    ensure_no_overlap(sroot, start, end)
    broot = batch_root(sroot, start, end)
    broot.mkdir(parents=True, exist_ok=False)
    for name in ("chapters", "receipts", "context"):
        (broot / name).mkdir()
    dump_yaml(batch_meta_path(broot), {
        "schema_version": 1, "story_id": sid, "start": start, "end": end, "count": count,
        "base_accepted_chapter": start - 1, "status": "OPEN", "created_at": now_iso(),
        "atomic_commit_required": True,
    })
    for chapter in range(start, end + 1):
        cdir = chapter_dir(broot, chapter)
        cdir.mkdir()
        dump_yaml(cdir / "receipt.yaml", chapter_receipt_template(chapter))
        (cdir / "prewrite.md").write_text(f"# Prewrite Contract — Chương {chapter}\n\n> PENDING\n", encoding="utf-8")
        (cdir / "draft.md").write_text("", encoding="utf-8")
        (cdir / "candidate.md").write_text("", encoding="utf-8")
        dump_yaml(cdir / "temp-delta.yaml", {
            "schema_version": 1, "chapter": chapter, "status": "PENDING", "events": [],
            "state_updates": [], "knowledge_updates": [], "thread_updates": [],
            "graph_updates": [], "timeline_updates": [],
        })
    dump_yaml(broot / "receipts" / "batch-review.yaml", {
        "schema_version": 1, "range": f"{start}-{end}", "status": "PENDING",
        "checks": {name: "PENDING" for name in required_batch_checks(batch_policy, count)},
        "issues": [], "updated_at": now_iso(),
    })
    dump_yaml(broot / "receipts" / "memory-connectivity.yaml", {
        "schema_version": 1, "range": f"{start}-{end}", "status": "PENDING",
        "checks": {name: "PENDING" for name in [
            "expected_deltas_extracted", "accepted_evidence_only", "knowledge_layers_preserved",
            "timeline_updates_complete", "open_threads_synced", "graph_edges_provenanced",
            "state_projection_matches_events",
        ]}, "issues": [], "updated_at": now_iso(),
    })
    print(f"OPENED {broot.relative_to(ROOT)}")
    print(f"range={start}-{end}")


def cmd_gate(args):
    _, _, sroot, _ = resolve_story()
    policy = load_yaml(BATCH_POLICY)
    broot = locate_batch(sroot, args.batch)
    errors = collect_gate_errors(broot, policy)
    if errors:
        print("GATE=HOLD")
        for item in errors:
            print(f"- {item}")
        raise SystemExit(3)
    meta = load_yaml(batch_meta_path(broot))
    print("GATE=PASS")
    print(f"range={meta['start']}-{meta['end']}")


def append_entries(path: Path, entries, chapter: int):
    data = load_yaml(path) if path.exists() else {"schema_version": 1, "entries": []}
    for entry in entries:
        item = dict(entry)
        item.setdefault("chapter", chapter)
        item.setdefault("source", f"chapters/ch{chapter:04d}.md")
        data.setdefault("entries", []).append(item)
    dump_yaml(path, data)


def apply_delta_to_ledgers(sroot: Path, chapter: int, delta: dict):
    ledgers = sroot / "ledgers"
    ledgers.mkdir(exist_ok=True)
    event_path = ledgers / "event-log.yaml"
    event_data = load_yaml(event_path) if event_path.exists() else {"schema_version": 1, "events": []}
    for event in delta.get("events", []):
        item = dict(event)
        item.setdefault("chapter", chapter)
        item.setdefault("source", f"chapters/ch{chapter:04d}.md")
        event_data.setdefault("events", []).append(item)
    dump_yaml(event_path, event_data)
    for key, filename in [
        ("state_updates", "state-deltas.yaml"), ("knowledge_updates", "knowledge.yaml"),
        ("thread_updates", "open-threads.yaml"), ("graph_updates", "graph.yaml"),
        ("timeline_updates", "timeline-deltas.yaml"),
    ]:
        append_entries(ledgers / filename, delta.get(key, []), chapter)


def cmd_commit(args):
    _, sid, sroot, manifest = resolve_story()
    policy = load_yaml(BATCH_POLICY)
    milestone_policy = load_yaml(MILESTONE_POLICY)
    broot = locate_batch(sroot, args.batch)
    meta = load_yaml(batch_meta_path(broot))
    start, end = int(meta["start"]), int(meta["end"])
    if start != latest_accepted(manifest) + 1:
        fail("Atomic commit base mismatch with accepted manifest")
    errors = collect_gate_errors(broot, policy)
    if errors:
        print("COMMIT=BLOCKED")
        for item in errors:
            print(f"- {item}")
        raise SystemExit(3)
    accepted_dir = sroot / "chapters"
    accepted_dir.mkdir(exist_ok=True)
    for chapter in range(start, end + 1):
        target = accepted_dir / f"ch{chapter:04d}.md"
        if target.exists():
            fail(f"Refuse overwrite accepted chapter: {target.relative_to(ROOT)}")
    staging = broot / ".atomic-staging"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir()
    for chapter in range(start, end + 1):
        shutil.copy2(chapter_dir(broot, chapter) / "candidate.md", staging / f"ch{chapter:04d}.md")
    for chapter in range(start, end + 1):
        os.replace(staging / f"ch{chapter:04d}.md", accepted_dir / f"ch{chapter:04d}.md")
    for chapter in range(start, end + 1):
        delta = load_yaml(chapter_dir(broot, chapter) / "temp-delta.yaml")
        apply_delta_to_ledgers(sroot, chapter, delta)
    manifest["latest_accepted_chapter"] = end
    manifest["next_chapter"] = end + 1
    manifest["status"] = "active"
    dump_yaml(sroot / "manifest.yaml", manifest)
    dump_yaml(sroot / "checkpoints" / f"checkpoint-{end:04d}.yaml", {
        "schema_version": 1, "story_id": sid, "through_chapter": end,
        "batch": f"{start}-{end}", "status": PASS, "created_at": now_iso(),
        "source_batch": broot.name,
    })
    meta["status"] = "COMMITTED"
    meta["committed_at"] = now_iso()
    dump_yaml(batch_meta_path(broot), meta)
    shutil.rmtree(staging, ignore_errors=True)
    due = milestone_due(end, milestone_policy)
    print(f"COMMIT=PASS range={start}-{end}")
    if due:
        print(f"MILESTONE_AUDIT_REQUIRED={due}")
        print(f"next_chapter_locked_until={audit_receipt_path(sroot, end).relative_to(ROOT)}:PASS")
    else:
        print(f"next_chapter={end + 1}")


def cmd_audit_template(args):
    _, sid, sroot, manifest = resolve_story()
    policy = load_yaml(MILESTONE_POLICY)
    chapter = args.chapter or latest_accepted(manifest)
    due = milestone_due(chapter, policy)
    if due is None:
        fail(f"Chapter {chapter} is not a configured audit milestone")
    rule = policy.get("milestones", {}).get(due) or policy.get("milestones", {}).get(str(due))
    checks = rule.get("checks", rule.get("actions", []))
    path = audit_receipt_path(sroot, chapter)
    if path.exists() and not args.force:
        fail(f"Audit receipt already exists: {path.relative_to(ROOT)}; use --force to replace")
    dump_yaml(path, {
        "schema_version": 1, "story_id": sid, "through_chapter": chapter, "milestone": due,
        "audit_name": rule.get("name"), "status": "PENDING",
        "checks": {name: "PENDING" for name in checks}, "metrics": {}, "issues": [],
        "repairs": [], "updated_at": now_iso(),
    })
    print(path.relative_to(ROOT))


def cmd_abort(args):
    _, _, sroot, _ = resolve_story()
    broot = locate_batch(sroot, args.batch)
    meta = load_yaml(batch_meta_path(broot))
    if meta.get("status") == "COMMITTED":
        fail("Cannot abort a committed batch")
    meta["status"] = "ABORTED"
    meta["aborted_at"] = now_iso()
    meta["reason"] = args.reason or "manual_abort"
    dump_yaml(batch_meta_path(broot), meta)
    print(f"ABORTED {broot.relative_to(ROOT)}")


def parser():
    p = argparse.ArgumentParser(description="Story OS fail-closed batch orchestrator")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("status"); s.set_defaults(func=cmd_status)
    s = sub.add_parser("begin"); s.add_argument("--count", type=int, choices=[5, 10]); s.set_defaults(func=cmd_begin)
    s = sub.add_parser("gate"); s.add_argument("--batch"); s.set_defaults(func=cmd_gate)
    s = sub.add_parser("commit"); s.add_argument("--batch"); s.set_defaults(func=cmd_commit)
    s = sub.add_parser("audit-template"); s.add_argument("--chapter", type=int); s.add_argument("--force", action="store_true"); s.set_defaults(func=cmd_audit_template)
    s = sub.add_parser("abort"); s.add_argument("--batch"); s.add_argument("--reason"); s.set_defaults(func=cmd_abort)
    return p


if __name__ == "__main__":
    args = parser().parse_args()
    args.func(args)
