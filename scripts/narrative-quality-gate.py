#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except Exception as exc:
    raise SystemExit("PyYAML is required: pip install pyyaml") from exc

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "config" / "story-os" / "narrative-quality-policy.yaml"
STORY_CFG = ROOT / "story.yaml"
PASS = "PASS"


def load_yaml(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"STORY_OS_HOLD: missing {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def resolve_story_root() -> Path:
    cfg = load_yaml(STORY_CFG)
    sid = cfg.get("active_story")
    if not sid:
        raise SystemExit("STORY_OS_HOLD: story.yaml missing active_story")
    root = ROOT / "stories" / sid
    if not root.exists():
        raise SystemExit(f"STORY_OS_HOLD: missing story root {root}")
    return root


def paragraphs(text: str):
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip() and not p.lstrip().startswith("#")]


def sentence_count(p: str) -> int:
    return max(1, len(re.findall(r"[.!?…]+(?:[\"”’']|$)", p)))


def style_scan(path: Path, policy: dict) -> list[str]:
    text = path.read_text(encoding="utf-8")
    ps = paragraphs(text)
    errors: list[str] = []
    warnings: list[str] = []
    frag = policy["style_metrics"]["paragraph_fragmentation"]
    short_max = int(frag["short_paragraph_max_chars"])
    block_run = int(frag["consecutive_short_paragraphs_block"])
    warn_run = int(frag["consecutive_short_paragraphs_warn"])
    run = max_run = 0
    for p in ps:
        if len(p) <= short_max:
            run += 1
            max_run = max(max_run, run)
        else:
            run = 0
    if max_run >= block_run:
        errors.append(f"paragraph_fragmentation: max short-paragraph run={max_run} >= {block_run}")
    elif max_run >= warn_run:
        warnings.append(f"paragraph_fragmentation warning: run={max_run}")

    if ps:
        one_sentence = sum(1 for p in ps if sentence_count(p) == 1)
        ratio = one_sentence / len(ps)
        if ratio >= float(frag["single_sentence_paragraph_ratio_block"]):
            errors.append(f"single_sentence_paragraph_ratio={ratio:.2f} exceeds block threshold")
        elif ratio >= float(frag["single_sentence_paragraph_ratio_warn"]):
            warnings.append(f"single_sentence_paragraph_ratio warning={ratio:.2f}")

    rhet = policy["style_metrics"]["rhetorical_patterns"]
    units = max(1.0, len(text) / 3000.0)
    warn_rate = float(rhet["repeated_pattern_warn_per_3000_chars"])
    block_rate = float(rhet["repeated_pattern_block_per_3000_chars"])
    for pat in rhet["patterns"]:
        count = text.count(pat)
        rate = count / units
        if rate >= block_rate:
            errors.append(f"rhetorical_pattern '{pat}' rate={rate:.2f}/3000 chars")
        elif rate >= warn_rate:
            warnings.append(f"rhetorical_pattern warning '{pat}' rate={rate:.2f}/3000 chars")

    for item in warnings:
        print(f"WARNING: {path.name}: {item}")
    return errors


def validate_semantic_receipt(path: Path, gates: list[str]) -> list[str]:
    if not path.exists():
        return [f"missing semantic receipt: {path}"]
    data = load_yaml(path)
    errors = []
    if data.get("status") != PASS:
        errors.append(f"receipt status={data.get('status')!r}, expected PASS")
    results = data.get("gates", {})
    for gate in gates:
        value = results.get(gate)
        if value == "NOT_APPLICABLE":
            reason = (data.get("reasons", {}) or {}).get(gate)
            if not reason:
                errors.append(f"{gate}=NOT_APPLICABLE without reason")
        elif value != PASS:
            errors.append(f"semantic gate {gate}={value!r}, expected PASS")
    return errors


def find_candidate_files(broot: Path):
    return sorted(broot.glob("chapters/ch*/candidate.md"))


def chapter_number_from_path(path: Path) -> int:
    m = re.search(r"ch(\d+)", str(path.parent.name))
    if not m:
        raise ValueError(path)
    return int(m.group(1))


def cmd_check(args):
    sroot = resolve_story_root()
    policy = load_yaml(POLICY)
    broot = sroot / ".work" / args.batch
    if not broot.exists():
        raise SystemExit(f"STORY_OS_HOLD: batch not found: {broot}")
    errors: list[str] = []
    candidates = find_candidate_files(broot)
    if not candidates:
        errors.append("no chapter candidate files found")
    for candidate in candidates:
        chapter = chapter_number_from_path(candidate)
        errors += [f"ch{chapter:04d}: {e}" for e in style_scan(candidate, policy)]
        receipt = broot / "receipts" / f"narrative-quality-ch{chapter:04d}.yaml"
        errors += [f"ch{chapter:04d}: {e}" for e in validate_semantic_receipt(receipt, policy["chapter_semantic_gates"])]
    batch_receipt = broot / "receipts" / "narrative-quality-batch.yaml"
    errors += [f"batch: {e}" for e in validate_semantic_receipt(batch_receipt, policy["batch_semantic_gates"])]
    if errors:
        print("NARRATIVE_QUALITY_GATE=HOLD")
        for e in errors:
            print(f"- {e}")
        raise SystemExit(3)
    print("NARRATIVE_QUALITY_GATE=PASS")


def template(status_gates: list[str]) -> dict:
    return {
        "schema_version": 1,
        "status": "PENDING",
        "gates": {g: "PENDING" for g in status_gates},
        "reasons": {},
        "issues": [],
        "evidence": [],
    }


def cmd_templates(args):
    sroot = resolve_story_root()
    policy = load_yaml(POLICY)
    broot = sroot / ".work" / args.batch
    if not broot.exists():
        raise SystemExit(f"STORY_OS_HOLD: batch not found: {broot}")
    receipts = broot / "receipts"
    receipts.mkdir(exist_ok=True)
    for candidate in find_candidate_files(broot):
        ch = chapter_number_from_path(candidate)
        path = receipts / f"narrative-quality-ch{ch:04d}.yaml"
        if not path.exists() or args.force:
            path.write_text(yaml.safe_dump(template(policy["chapter_semantic_gates"]), allow_unicode=True, sort_keys=False), encoding="utf-8")
    path = receipts / "narrative-quality-batch.yaml"
    if not path.exists() or args.force:
        path.write_text(yaml.safe_dump(template(policy["batch_semantic_gates"]), allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"created narrative quality receipt templates under {receipts}")


def parser():
    p = argparse.ArgumentParser(description="Fail-closed narrative quality gate")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("templates"); s.add_argument("--batch", required=True); s.add_argument("--force", action="store_true"); s.set_defaults(func=cmd_templates)
    s = sub.add_parser("check"); s.add_argument("--batch", required=True); s.set_defaults(func=cmd_check)
    return p


if __name__ == "__main__":
    args = parser().parse_args()
    args.func(args)
