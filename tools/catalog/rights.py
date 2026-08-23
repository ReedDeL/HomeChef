"""Rights-manifest contract for approved catalog archives."""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class ReleaseSource(BaseModel):
    """One auditable source record emitted with a catalog release.

    This is broader than a downloadable archive: the protected loader maps
    these fields directly to ``catalog_release_sources``, including
    HomeChef-authored source material.
    """

    model_config = {"extra": "forbid", "populate_by_name": True}

    id: str
    version: str
    title: str
    archive_url: str = Field(alias="archiveUrl")
    sha256: str
    license_name: str = Field(alias="licenseName")
    license_url: str = Field(alias="licenseUrl")
    attribution: str
    status: Literal["approved", "quarantine"]

    @field_validator("id", "version", "title", "license_name", "attribution")
    @classmethod
    def require_text(cls, value: str) -> str:
        """Reject blank source metadata before it can become unrecoverable."""
        if not value.strip():
            raise ValueError("must not be blank")
        return value.strip()

    @field_validator("sha256")
    @classmethod
    def require_lowercase_sha256(cls, value: str) -> str:
        if not _SHA256.fullmatch(value):
            raise ValueError("must be an exact lowercase SHA-256")
        return value

    @field_validator("archive_url", "license_url")
    @classmethod
    def require_https_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("must be an HTTPS URL")
        return value


class RightsSource(ReleaseSource):
    """One auditable archive candidate.

    Only approved entries are eligible for download or ingestion. Keeping all
    rights fields mandatory makes missing legal context a build failure instead
    of an accidental release decision.
    """

    archive_format: Literal["jsonl"] = Field(alias="archiveFormat")

    def to_release_source(self) -> ReleaseSource:
        """Remove archive-ingestion-only metadata at the release handoff boundary."""
        return ReleaseSource(
            id=self.id,
            version=self.version,
            title=self.title,
            archiveUrl=self.archive_url,
            sha256=self.sha256,
            licenseName=self.license_name,
            licenseUrl=self.license_url,
            attribution=self.attribution,
            status=self.status,
        )


class RightsManifest(BaseModel):
    """Versioned source list; duplicate source/version pairs are ambiguous."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    schema_version: Literal[1] = Field(alias="schemaVersion")
    sources: list[RightsSource]

    @model_validator(mode="after")
    def reject_duplicate_source_versions(self) -> RightsManifest:
        identities = [(source.id, source.version) for source in self.sources]
        if len(identities) != len(set(identities)):
            raise ValueError("duplicate source/version entry")
        source_ids = [source.id for source in self.sources]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("duplicate source id in one release")
        return self

    def approved_sources(self) -> list[RightsSource]:
        """Return release-eligible sources in deterministic manifest order."""
        return [source for source in self.sources if source.status == "approved"]

    def source(self, source_id: str) -> RightsSource:
        """Resolve a manifest source or fail before reading any archive."""
        for source in self.sources:
            if source.id == source_id:
                return source
        raise ValueError(f"source {source_id!r} is not in the rights manifest")
