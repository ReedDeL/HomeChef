"""Explicit local-only command boundaries for catalog releases."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from tools.catalog.__main__ import main
from tools.catalog.pipeline import build_release, write_release
from tools.catalog.rights import RightsManifest


def write_manifest(path: Path, archive: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "sources": [
                    {
                        "id": "fixture-source",
                        "version": "1",
                        "title": "Fixture source",
                        "archiveUrl": "https://example.test/catalog.jsonl",
                        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                        "archiveFormat": "jsonl",
                        "licenseName": "CC0",
                        "licenseUrl": "https://example.test/license",
                        "attribution": "Fixture source, CC0.",
                        "status": "approved",
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )


def write_release_fixture(tmp_path: Path) -> Path:
    archive = tmp_path / "source.jsonl"
    archive.write_text(
        json.dumps(
            {
                "sourceRecipeId": "source-1",
                "title": "Rice Bowl",
                "instructions": "Microwave rice for 3 minutes.",
                "ingredients": [{"name": "Rice", "measure": "1 cup"}],
                "totalTimeMinutes": 5,
                "equipment": ["microwave"],
                "allergenStatus": "verified",
                "dietaryStatus": "verified",
                "dietaryTags": [],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    manifest_path = tmp_path / "manifest.json"
    write_manifest(manifest_path, archive)
    manifest = RightsManifest.model_validate(json.loads(manifest_path.read_text(encoding="utf-8")))
    release = tmp_path / "release.json"
    write_release(build_release(manifest, {"fixture-source": archive}), release)
    return release


def test_load_rejects_an_incomplete_release_artifact(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Would fail if a JSON object bypassed the local release contract."""
    release = tmp_path / "release.json"
    release.write_text("{}\n", encoding="utf-8")

    assert main(["load", "--release", str(release)]) == 1
    assert "catalog command failed" in capsys.readouterr().err


def test_load_validates_a_complete_local_release(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Would fail if a release written by the pipeline could not hand off locally."""
    release = write_release_fixture(tmp_path)

    assert main(["load", "--release", str(release)]) == 0
    assert "local handoff" in capsys.readouterr().out


def test_validate_rejects_incomplete_and_accepts_complete_release(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Would fail if validate diverged from the local handoff contract."""
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}\n", encoding="utf-8")
    valid = write_release_fixture(tmp_path)

    assert main(["validate", "--release", str(invalid)]) == 1
    assert "catalog command failed" in capsys.readouterr().err
    assert main(["validate", "--release", str(valid)]) == 0
    assert "release is valid" in capsys.readouterr().out


def test_activate_validates_before_stopping_at_hosted_boundary(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Would fail if activation accepted malformed local release data."""
    release = write_release_fixture(tmp_path)

    assert main(["activate", "--release", str(release)]) == 2
    assert "not connected" in capsys.readouterr().err


def test_activate_rejects_incomplete_release_before_hosted_boundary(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Would fail if activation treated parseable JSON as a valid release."""
    release = tmp_path / "release.json"
    release.write_text("{}\n", encoding="utf-8")

    assert main(["activate", "--release", str(release)]) == 1
    assert "catalog command failed" in capsys.readouterr().err


def test_download_command_uses_the_pinned_local_boundary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Would fail if the explicit download command were absent or skipped its destination."""
    archive = tmp_path / "source.jsonl"
    archive.write_text("fixture\n", encoding="utf-8")
    manifest = tmp_path / "manifest.json"
    write_manifest(manifest, archive)
    output = tmp_path / "downloaded.jsonl"

    def fake_download(source: object, destination: Path, *, overwrite: bool) -> Path:
        assert destination == output
        assert overwrite is False
        destination.write_bytes(b"downloaded")
        return destination

    monkeypatch.setattr("tools.catalog.__main__.download_archive", fake_download)

    assert (
        main(
            [
                "download",
                "--manifest",
                str(manifest),
                "--source-id",
                "fixture-source",
                "--output",
                str(output),
            ]
        )
        == 0
    )
    assert output.read_bytes() == b"downloaded"
