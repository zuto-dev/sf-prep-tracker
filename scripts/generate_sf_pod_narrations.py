#!/usr/bin/env python3
"""Generate SF Pod briefing narration MP3s from app-owned pods.json text.

WHAT THIS SCRIPT DOES
----------------------
Renders one narration MP3 per CURRENT production debrief in pods.json, using
ONLY the app's own already-written text (title / summary / takeaways /
skills / homework / source). It is a read-aloud of the app's briefing notes
-- it is NEVER the original podcast audio, NEVER a voice clone of a real
host, and pulls from NO external API or network source. Every generated
script opens and closes with an explicit "reference-only narration, not the
original podcast" attribution line, matching the exact-mapped resolver in
app/lib/sf-pod-narrations.ts (`SF Pod briefing narration`).

This script uses only what already ships on macOS + this repo's toolchain:
  - `say` (macOS built-in text-to-speech) to render narration to AIFF
  - `ffmpeg` (already present on this machine) to transcode AIFF -> MP3 and
    probe the resulting file's duration/codec

No pip packages, no npm packages, no network calls. It NEVER modifies
pods.json -- it only reads it -- and it never invokes itself; it is meant to
be run explicitly by a human/operator after reviewing this script, not
auto-invoked by any other code in this repo.

USAGE
-----
    python3 scripts/generate_sf_pod_narrations.py \
        --pods-json /path/to/pods.json \
        --out-dir /path/to/public/audio \
        [--voice "Alex"] \
        [--dry-run] \
        [--only 2026-07-17]

Exit codes: 0 on success (including a clean --dry-run), 1 on any
malformed-input or command-failure condition. Never partially overwrites an
existing valid MP3 without --force.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

NARRATION_LABEL = "SF Pod briefing narration"

# The exact {date, title} pairs for the 10 CURRENT production debriefs. Kept
# in lockstep with app/lib/sf-pod-narrations.ts's KNOWN_SF_POD_NARRATIONS --
# if you add a new debrief, update BOTH files together. This script refuses
# to render narration for any pod not on this list, even if pods.json
# contains it, so a cron-mutated/stale pods.json can never silently mint new
# audio without an explicit, reviewed update to this allowlist.
KNOWN_SF_POD_NARRATIONS: tuple[dict[str, str], ...] = (
    {"date": "2026-07-17", "title": "Ruck Up or Shut Up \u2014 Walton's Operating System"},
    {"date": "2026-07-14", "title": "Water Confidence: The Event Nobody Trains For Until It's Too Late"},
    {"date": "2026-07-13", "title": "Peer Evals: The Filter Nobody Prepares For"},
    {"date": "2026-07-12", "title": "Land Nav: The Skill That Decides the Star Course"},
    {"date": "2026-07-11", "title": "Son Tay: The Raid That Rewrote Special Operations"},
    {"date": "2026-07-10", "title": "The Special Forces Groups: Where You Actually End Up"},
    {"date": "2026-07-09", "title": "Selection Is a Mental Event with a Physical Component"},
    {"date": "2026-07-08", "title": "Rucking: How Not to Blow Out Your Feet and Back"},
    {"date": "2026-07-07", "title": "The ODA: Why It's Twelve Men"},
    {"date": "2026-07-06", "title": "SFAS: What Actually Gets People Cut"},
)


class GeneratorError(RuntimeError):
    """Raised for any malformed-input or command-failure condition."""


@dataclass(frozen=True)
class PodRecord:
    date: str
    title: str
    summary: str
    takeaways: tuple[str, ...]
    skills: tuple[dict[str, str], ...]
    homework: str | None
    source: str | None


def load_pods(pods_json_path: Path) -> list[PodRecord]:
    """Reads + validates pods.json. Never writes/modifies the file."""
    if not pods_json_path.is_file():
        raise GeneratorError(f"--pods-json path does not exist or is not a file: {pods_json_path}")

    try:
        raw_text = pods_json_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise GeneratorError(f"could not read {pods_json_path}: {exc}") from exc

    try:
        data: Any = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise GeneratorError(f"{pods_json_path} is not valid JSON: {exc}") from exc

    if not isinstance(data, list):
        raise GeneratorError(f"{pods_json_path} must be a JSON array of pod objects, got {type(data).__name__}")

    records: list[PodRecord] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise GeneratorError(f"pods.json[{i}] is not an object")
        date = item.get("date")
        title = item.get("title")
        summary = item.get("summary")
        takeaways = item.get("takeaways")
        skills = item.get("skills")
        homework = item.get("homework")
        source = item.get("source")

        if not isinstance(date, str) or not date.strip():
            raise GeneratorError(f"pods.json[{i}] missing/blank 'date'")
        if not isinstance(title, str) or not title.strip():
            raise GeneratorError(f"pods.json[{i}] missing/blank 'title'")
        if not isinstance(summary, str) or not summary.strip():
            raise GeneratorError(f"pods.json[{i}] ({date}) missing/blank 'summary'")
        if not isinstance(takeaways, list) or not all(isinstance(t, str) for t in takeaways):
            raise GeneratorError(f"pods.json[{i}] ({date}) 'takeaways' must be a list of strings")
        if not isinstance(skills, list) or not all(
            isinstance(s, dict) and isinstance(s.get("title"), str) and isinstance(s.get("detail"), str)
            for s in skills
        ):
            raise GeneratorError(f"pods.json[{i}] ({date}) 'skills' must be a list of {{title, detail}} objects")
        if homework is not None and not isinstance(homework, str):
            raise GeneratorError(f"pods.json[{i}] ({date}) 'homework' must be a string when present")
        if source is not None and not isinstance(source, str):
            raise GeneratorError(f"pods.json[{i}] ({date}) 'source' must be a string when present")

        records.append(
            PodRecord(
                date=date,
                title=title,
                summary=summary,
                takeaways=tuple(takeaways),
                skills=tuple({"title": s["title"], "detail": s["detail"]} for s in skills),
                homework=homework,
                source=source,
            )
        )
    return records


def known_narration_keys() -> set[tuple[str, str]]:
    return {(k["date"], k["title"]) for k in KNOWN_SF_POD_NARRATIONS}


def select_known_current_pods(records: list[PodRecord], only_dates: set[str] | None) -> list[PodRecord]:
    """Exact-maps pods.json rows against the fixed known-current allowlist.

    Any pods.json row whose (date, title) is not an exact hit in
    KNOWN_SF_POD_NARRATIONS is skipped entirely -- this script never
    generates narration for unknown/renamed/stale content, matching
    resolveSfPodNarration's null-on-mismatch contract.
    """
    known = known_narration_keys()
    selected = [r for r in records if (r.date, r.title) in known]
    if only_dates:
        selected = [r for r in selected if r.date in only_dates]
    return selected


def narration_path_for_date(out_dir: Path, date: str) -> Path:
    return out_dir / f"sf-pod-narration-{date}.mp3"


def build_narration_script(pod: PodRecord) -> str:
    """Builds the spoken narration script text from app-owned fields only.

    Structure: explicit reference-only attribution -> title -> summary ->
    numbered takeaways -> skills/details -> homework -> closing attribution.
    Every sentence here is either boilerplate framing or verbatim/lightly-
    joined app text -- nothing is invented, and no external source content
    is included.
    """
    lines: list[str] = []
    lines.append(
        f"{NARRATION_LABEL}. This is a reference-only narration of the app's own written "
        "briefing notes. It is not the original podcast episode, and it is not a recording "
        "of any host's voice."
    )
    lines.append(f"Title: {pod.title}.")
    lines.append(f"Summary: {pod.summary}")

    if pod.takeaways:
        lines.append("Key takeaways.")
        for i, takeaway in enumerate(pod.takeaways, start=1):
            lines.append(f"Takeaway {i}. {takeaway}")

    if pod.skills:
        lines.append("Skills and details.")
        for skill in pod.skills:
            lines.append(f"{skill['title']}. {skill['detail']}")

    if pod.homework:
        lines.append(f"Homework: {pod.homework}")

    if pod.source:
        lines.append(f"Source reference: {pod.source}")

    lines.append(
        f"End of {NARRATION_LABEL}. Again, this was a read-aloud of the app's own briefing "
        "notes, not the original podcast."
    )
    return "\n\n".join(lines)


def run_command(cmd: list[str], *, dry_run: bool) -> None:
    """Runs a subprocess command, raising GeneratorError with clear context on any nonzero exit."""
    if dry_run:
        print(f"[dry-run] would run: {' '.join(cmd)}")
        return
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise GeneratorError(f"command not found: {cmd[0]} ({exc})") from exc
    if result.returncode != 0:
        raise GeneratorError(
            f"command failed (exit {result.returncode}): {' '.join(cmd)}\n"
            f"stdout: {result.stdout.strip()}\nstderr: {result.stderr.strip()}"
        )


def probe_mp3(mp3_path: Path, *, ffprobe_bin: str) -> None:
    """Probes the rendered MP3 for a nonzero duration and audio/mpeg-family codec. Raises on failure."""
    cmd = [
        ffprobe_bin,
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_name,codec_type",
        "-of",
        "json",
        str(mp3_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise GeneratorError(f"ffprobe not found ({ffprobe_bin}): {exc}") from exc
    if result.returncode != 0:
        raise GeneratorError(f"ffprobe failed on {mp3_path}: {result.stderr.strip()}")

    try:
        probe_data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise GeneratorError(f"ffprobe returned non-JSON output for {mp3_path}: {exc}") from exc

    fmt = probe_data.get("format", {})
    duration_raw = fmt.get("duration")
    try:
        duration = float(duration_raw)
    except (TypeError, ValueError) as exc:
        raise GeneratorError(f"{mp3_path} has no readable duration in ffprobe output") from exc
    if duration <= 0:
        raise GeneratorError(f"{mp3_path} probed with nonpositive duration ({duration})")

    streams = probe_data.get("streams", [])
    has_audio_stream = any(s.get("codec_type") == "audio" for s in streams)
    if not has_audio_stream:
        raise GeneratorError(f"{mp3_path} has no audio stream per ffprobe")

    # mp3 files decode to codec_name "mp3" (libmp3lame-encoded); accept that
    # family explicitly rather than any arbitrary codec, so a mis-rendered
    # non-audio file can never silently pass this gate.
    audio_codec_names = {s.get("codec_name") for s in streams if s.get("codec_type") == "audio"}
    if not audio_codec_names & {"mp3", "mp3float"}:
        raise GeneratorError(f"{mp3_path} audio stream codec is not mp3-family: {audio_codec_names}")


def generate_one(
    pod: PodRecord,
    *,
    out_dir: Path,
    voice: str | None,
    say_bin: str,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    dry_run: bool,
    force: bool,
) -> Path:
    out_path = narration_path_for_date(out_dir, pod.date)
    if out_path.exists() and not force and not dry_run:
        print(f"skip (already exists, pass --force to regenerate): {out_path}")
        return out_path

    script_text = build_narration_script(pod)

    if dry_run:
        print(f"[dry-run] {pod.date} -> {out_path}")
        print(f"[dry-run] script length: {len(script_text)} chars, {len(pod.takeaways)} takeaways, "
              f"{len(pod.skills)} skills")
        return out_path

    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="sf-pod-narration-") as tmp_dir_str:
        tmp_dir = Path(tmp_dir_str)
        script_path = tmp_dir / f"{pod.date}.txt"
        aiff_path = tmp_dir / f"{pod.date}.aiff"
        script_path.write_text(script_text, encoding="utf-8")

        say_cmd = [say_bin, "-f", str(script_path), "-o", str(aiff_path)]
        if voice:
            say_cmd[1:1] = ["-v", voice]
        run_command(say_cmd, dry_run=False)

        if not aiff_path.is_file() or aiff_path.stat().st_size == 0:
            raise GeneratorError(f"say produced no/empty AIFF output for {pod.date}: {aiff_path}")

        tmp_mp3_path = tmp_dir / f"{pod.date}.mp3"
        ffmpeg_cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            str(aiff_path),
            "-codec:a",
            "libmp3lame",
            "-qscale:a",
            "2",
            str(tmp_mp3_path),
        ]
        run_command(ffmpeg_cmd, dry_run=False)

        if not tmp_mp3_path.is_file() or tmp_mp3_path.stat().st_size == 0:
            raise GeneratorError(f"ffmpeg produced no/empty MP3 output for {pod.date}: {tmp_mp3_path}")

        probe_mp3(tmp_mp3_path, ffprobe_bin=ffprobe_bin)

        # Only move the validated MP3 into place after every prior step
        # succeeded -- never leaves a partially-written file at out_path.
        shutil.move(str(tmp_mp3_path), str(out_path))

    print(f"generated: {out_path}")
    return out_path


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pods-json", required=True, type=Path, help="Path to the pods.json to read (read-only).")
    parser.add_argument("--out-dir", required=True, type=Path, help="Directory to write sf-pod-narration-<date>.mp3 files into.")
    parser.add_argument("--voice", default=None, help="Optional macOS `say` voice name (e.g. 'Alex').")
    parser.add_argument("--only", action="append", default=None, metavar="YYYY-MM-DD",
                         help="Restrict generation to one or more specific dates. May be passed multiple times.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be generated without calling say/ffmpeg or writing files.")
    parser.add_argument("--force", action="store_true", help="Regenerate even if the output MP3 already exists.")
    parser.add_argument("--say-bin", default="say", help="Path to the macOS `say` binary (default: 'say' on PATH).")
    parser.add_argument("--ffmpeg-bin", default="ffmpeg", help="Path to ffmpeg (default: 'ffmpeg' on PATH).")
    parser.add_argument("--ffprobe-bin", default="ffprobe", help="Path to ffprobe (default: 'ffprobe' on PATH).")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    try:
        records = load_pods(args.pods_json)
    except GeneratorError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    only_dates = set(args.only) if args.only else None
    selected = select_known_current_pods(records, only_dates)

    if not selected:
        print(
            "error: no rows in --pods-json exactly match the known-current SF Pod narration "
            "allowlist (by date AND title) -- refusing to generate anything.",
            file=sys.stderr,
        )
        return 1

    if only_dates:
        missing = only_dates - {r.date for r in selected}
        if missing:
            print(f"error: --only date(s) not found in the known-current allowlist: {sorted(missing)}", file=sys.stderr)
            return 1

    print(f"{len(selected)} known-current pod(s) selected for narration generation"
          f"{' (dry-run)' if args.dry_run else ''}.")

    failures: list[str] = []
    for pod in selected:
        try:
            generate_one(
                pod,
                out_dir=args.out_dir,
                voice=args.voice,
                say_bin=args.say_bin,
                ffmpeg_bin=args.ffmpeg_bin,
                ffprobe_bin=args.ffprobe_bin,
                dry_run=args.dry_run,
                force=args.force,
            )
        except GeneratorError as exc:
            print(f"error generating narration for {pod.date} ({pod.title}): {exc}", file=sys.stderr)
            failures.append(pod.date)

    if failures:
        print(f"failed to generate narration for: {failures}", file=sys.stderr)
        return 1

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
