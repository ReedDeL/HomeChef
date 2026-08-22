"""Checksum-pinned bulk archive downloads."""

from __future__ import annotations

import hashlib
import os
import tempfile
from collections.abc import Callable
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse
from urllib.request import urlopen

from tools.catalog.rights import RightsSource

_CHUNK_SIZE = 64 * 1024
_TIMEOUT_SECONDS = 30.0


class DownloadResponse(Protocol):
    """The small standard-library response surface the downloader needs."""

    def read(self, size: int = -1) -> bytes: ...

    def geturl(self) -> str: ...


Opener = Callable[..., AbstractContextManager[DownloadResponse]]


def download_archive(
    source: RightsSource,
    destination: Path,
    *,
    opener: Opener = urlopen,
    timeout_seconds: float = _TIMEOUT_SECONDS,
    overwrite: bool = False,
) -> Path:
    """Download one approved archive and atomically place only verified bytes.

    The injectable opener keeps verification fully local. ``urlopen`` follows
    redirects, so the resolved URL is checked after opening as well as the
    manifest URL checked by ``RightsSource``.
    """
    if source.status != "approved":
        raise ValueError(f"source {source.id!r} is not approved for download")
    if timeout_seconds <= 0:
        raise ValueError("timeout must be positive")
    if destination.exists() and not overwrite:
        raise FileExistsError(f"refusing to overwrite {destination}; pass overwrite=True")

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    digest = hashlib.sha256()
    try:
        with opener(source.archive_url, timeout=timeout_seconds) as response:
            if urlparse(response.geturl()).scheme != "https":
                raise ValueError("redirected archive URL must use HTTPS")

            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=destination.parent,
                prefix=f".{destination.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                while chunk := response.read(_CHUNK_SIZE):
                    digest.update(chunk)
                    temporary.write(chunk)
                temporary.flush()
                os.fsync(temporary.fileno())

        if digest.hexdigest() != source.sha256:
            raise ValueError("archive checksum does not match the rights manifest")
        if temporary_path is None:  # pragma: no cover - tempfile always yields a path
            raise RuntimeError("download did not create a temporary archive")
        temporary_path.replace(destination)
        return destination
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise
