"""Rights manifest tests for the source-neutral catalog boundary."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from tools.catalog.rights import RightsManifest


def approved_source(**overrides: object) -> dict[str, object]:
    source: dict[str, object] = {
        "id": "public-domain-cookbook",
        "version": "2026-08",
        "title": "Public Domain Cookbook",
        "archiveUrl": "https://example.test/catalog.jsonl",
        "sha256": "a" * 64,
        "archiveFormat": "jsonl",
        "licenseName": "CC0-1.0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "attribution": "Public Domain Cookbook, CC0.",
        "status": "approved",
    }
    source.update(overrides)
    return source


def test_manifest_accepts_an_approved_checksum_pinned_source() -> None:
    """Would fail if approved sources stopped carrying auditable provenance."""
    manifest = RightsManifest.model_validate({"schemaVersion": 1, "sources": [approved_source()]})

    assert manifest.approved_sources()[0].id == "public-domain-cookbook"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sha256", "not-a-checksum"),
        ("archiveUrl", "http://example.test/catalog.jsonl"),
        ("licenseName", ""),
        ("attribution", "   "),
    ],
)
def test_manifest_rejects_invalid_rights_or_provenance(field: str, value: str) -> None:
    """Would fail if an untraceable or unpinned source entered the build."""
    with pytest.raises(ValidationError):
        RightsManifest.model_validate(
            {"schemaVersion": 1, "sources": [approved_source(**{field: value})]}
        )


def test_manifest_rejects_duplicate_source_versions() -> None:
    """Would fail if source ordering could silently choose a duplicate archive."""
    with pytest.raises(ValidationError, match="duplicate"):
        RightsManifest.model_validate(
            {"schemaVersion": 1, "sources": [approved_source(), approved_source()]}
        )


def test_manifest_rejects_multiple_versions_of_one_source_id() -> None:
    """Would fail if a release could choose an archive for one source ambiguously."""
    with pytest.raises(ValidationError, match="duplicate source id"):
        RightsManifest.model_validate(
            {
                "schemaVersion": 1,
                "sources": [approved_source(), approved_source(version="2026-09")],
            }
        )
