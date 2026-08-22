"""Non-interactive catalog commands; only explicit ``download`` opens a URL."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import ValidationError

from tools.catalog.download import download_archive
from tools.catalog.pipeline import build_release, ingest_archive, load_release, write_release
from tools.catalog.rights import RightsManifest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_OUTPUT = _REPO_ROOT / "build" / "catalog"
_DEFAULT_MANIFEST = Path(__file__).resolve().parent / "rights-manifest.json"


def main(argv: Sequence[str] | None = None) -> int:
    """Run an explicit command; hosted state is never mutated in this task."""
    parser = argparse.ArgumentParser(description="Build a rights-first HomeChef catalog release.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    _add_ingest_parser(subparsers)
    _add_download_parser(subparsers)
    _add_validate_parser(subparsers)
    _add_build_offline_parser(subparsers)
    _add_release_parser(subparsers, "load", "validate a local release for later protected loading")
    _add_release_parser(subparsers, "activate", "stop at the not-yet-connected activation boundary")
    args = parser.parse_args(argv)

    try:
        if args.command == "ingest":
            return _ingest(args)
        if args.command == "download":
            return _download(args)
        if args.command == "validate":
            return _validate(args)
        if args.command == "build-offline":
            return _build_offline(args)
        if args.command == "load":
            load_release(args.release)
            print(f"local handoff validated: {args.release}")
            return 0
        load_release(args.release)
        print("activation is not connected to hosted state until Task 3", file=sys.stderr)
        return 2
    except (OSError, json.JSONDecodeError, ValidationError, ValueError) as error:
        print(f"catalog command failed: {error}", file=sys.stderr)
        return 1


def _add_ingest_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("ingest", help="ingest one approved local JSONL archive")
    _add_source_args(parser)
    parser.add_argument("--output", type=Path, default=_DEFAULT_OUTPUT / "ingest.json")
    parser.add_argument("--overwrite", action="store_true")


def _add_download_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("download", help="download one approved checksum-pinned archive")
    parser.add_argument("--manifest", type=Path, default=_DEFAULT_MANIFEST)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--output", type=Path, default=_DEFAULT_OUTPUT / "archive.jsonl")
    parser.add_argument("--overwrite", action="store_true")


def _add_validate_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("validate", help="validate an existing local release artifact")
    parser.add_argument("--release", type=Path, required=True)


def _add_build_offline_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    parser = subparsers.add_parser(
        "build-offline", help="build deterministic candidate and offline artifacts"
    )
    parser.add_argument("--manifest", type=Path, default=_DEFAULT_MANIFEST)
    parser.add_argument("--archive", action="append", default=[], metavar="SOURCE_ID=PATH")
    parser.add_argument("--output", type=Path, default=_DEFAULT_OUTPUT / "release.json")
    parser.add_argument("--overwrite", action="store_true")


def _add_release_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser], name: str, help_text: str
) -> None:
    parser = subparsers.add_parser(name, help=help_text)
    parser.add_argument("--release", type=Path, required=True)


def _add_source_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--manifest", type=Path, default=_DEFAULT_MANIFEST)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--archive", type=Path, required=True)


def _ingest(args: argparse.Namespace) -> int:
    manifest = _read_manifest(args.manifest)
    source = manifest.source(args.source_id)
    result = ingest_archive(source, args.archive)
    _write_json(args.output, result.model_dump(by_alias=True), args.overwrite)
    print(f"ingested {len(result.recipes)} recipes; quarantined {len(result.quarantine)}")
    return 0


def _download(args: argparse.Namespace) -> int:
    manifest = _read_manifest(args.manifest)
    source = manifest.source(args.source_id)
    _ensure_not_transitional(args.output)
    download_archive(source, args.output, overwrite=args.overwrite)
    print(f"downloaded {source.id} to {args.output}")
    return 0


def _validate(args: argparse.Namespace) -> int:
    load_release(args.release)
    print(f"release is valid: {args.release}")
    return 0


def _build_offline(args: argparse.Namespace) -> int:
    manifest = _read_manifest(args.manifest)
    release = build_release(manifest, _archive_mapping(args.archive))
    _ensure_not_transitional(args.output)
    write_release(release, args.output, overwrite=args.overwrite)
    print(f"built {release.counts['recipes']} recipes; offline {release.counts['offlineRecipes']}")
    return 0


def _read_manifest(path: Path) -> RightsManifest:
    return RightsManifest.model_validate(_read_json(path))


def _read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def _archive_mapping(values: list[str]) -> dict[str, Path]:
    archives: dict[str, Path] = {}
    for value in values:
        source_id, separator, raw_path = value.partition("=")
        if not separator or not source_id or not raw_path:
            raise ValueError("--archive must be SOURCE_ID=PATH")
        if source_id in archives:
            raise ValueError(f"duplicate archive supplied for {source_id!r}")
        archives[source_id] = Path(raw_path)
    return archives


def _write_json(path: Path, payload: object, overwrite: bool) -> None:
    _ensure_not_transitional(path)
    if path.exists() and not overwrite:
        raise ValueError(f"refusing to overwrite {path}; pass --overwrite")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _ensure_not_transitional(path: Path) -> None:
    try:
        path.resolve().relative_to(_REPO_ROOT / "src" / "data")
    except ValueError:
        return
    raise ValueError("catalog outputs must not overwrite transitional src/data artifacts")


if __name__ == "__main__":
    sys.exit(main())
