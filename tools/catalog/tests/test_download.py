"""Pinned bulk-download behavior with deterministic local responses."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from contextlib import AbstractContextManager
from pathlib import Path

import pytest

from tools.catalog.download import DownloadResponse, download_archive
from tools.catalog.rights import RightsSource


class FakeResponse:
    def __init__(self, payload: bytes, final_url: str) -> None:
        self._payload = payload
        self._final_url = final_url
        self._position = 0

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = len(self._payload) - self._position
        chunk = self._payload[self._position : self._position + size]
        self._position += len(chunk)
        return chunk

    def geturl(self) -> str:
        return self._final_url


def approved_source(payload: bytes, **overrides: object) -> RightsSource:
    source: dict[str, object] = {
        "id": "fixture-source",
        "version": "1",
        "title": "Fixture source",
        "archiveUrl": "https://example.test/archive.jsonl",
        "sha256": hashlib.sha256(payload).hexdigest(),
        "archiveFormat": "jsonl",
        "licenseName": "CC0",
        "licenseUrl": "https://example.test/license",
        "attribution": "Fixture source, CC0.",
        "status": "approved",
    }
    source.update(overrides)
    return RightsSource.model_validate(source)


def opener_for(
    payload: bytes, final_url: str
) -> Callable[..., AbstractContextManager[DownloadResponse]]:
    def opener(_: str, *, timeout: float) -> FakeResponse:
        assert timeout > 0
        return FakeResponse(payload, final_url)

    return opener


def test_download_streams_verified_archive_then_places_it_atomically(tmp_path: Path) -> None:
    """Would fail if a mismatched or partial archive could be accepted."""
    payload = b'{"sourceRecipeId":"one"}\n'
    target = tmp_path / "archive.jsonl"

    result = download_archive(
        approved_source(payload),
        target,
        opener=opener_for(payload, "https://cdn.test/archive.jsonl"),
    )

    assert result == target
    assert target.read_bytes() == payload
    assert not list(tmp_path.glob("*.tmp"))


def test_download_rejects_bad_checksum_without_placing_an_archive(tmp_path: Path) -> None:
    """Would fail if the downloader accepted bytes before checking the pin."""
    target = tmp_path / "archive.jsonl"

    with pytest.raises(ValueError, match="checksum"):
        download_archive(
            approved_source(b"expected", sha256="b" * 64),
            target,
            opener=opener_for(b"different", "https://cdn.test/archive.jsonl"),
        )

    assert not target.exists()


def test_download_rejects_redirects_that_downgrade_to_http(tmp_path: Path) -> None:
    """Would fail if a safe manifest URL could redirect to an unsafe endpoint."""
    payload = b"safe bytes"

    with pytest.raises(ValueError, match="HTTPS"):
        download_archive(
            approved_source(payload),
            tmp_path / "archive.jsonl",
            opener=opener_for(payload, "http://unsafe.test/archive.jsonl"),
        )


def test_download_requires_explicit_overwrite_and_keeps_old_file_on_failure(tmp_path: Path) -> None:
    """Would fail if an existing accepted archive could be silently replaced."""
    target = tmp_path / "archive.jsonl"
    target.write_bytes(b"previous verified archive")

    with pytest.raises(FileExistsError, match="overwrite"):
        download_archive(
            approved_source(b"replacement"),
            target,
            opener=opener_for(b"replacement", "https://cdn.test/archive.jsonl"),
        )
    assert target.read_bytes() == b"previous verified archive"

    with pytest.raises(ValueError, match="checksum"):
        download_archive(
            approved_source(b"replacement", sha256="a" * 64),
            target,
            opener=opener_for(b"untrusted", "https://cdn.test/archive.jsonl"),
            overwrite=True,
        )
    assert target.read_bytes() == b"previous verified archive"
