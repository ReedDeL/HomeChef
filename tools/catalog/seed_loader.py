"""HomeChef-authored microwave seed recipes for curated offline releases."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from tools.catalog.measurements import parse_measure
from tools.catalog.models import CatalogIngredient, CatalogRecipe, Equipment, Provenance
from tools.catalog.normalize import allergen_groups_for
from tools.catalog.rights import ReleaseSource

SEED_DIR = Path(__file__).resolve().parent / "seed"

# Every recipe in microwave.json is written for a microwave and nothing else.
# That is the point of the file, so it is asserted here rather than repeated
# twenty times in the JSON where one copy could drift from the rest.
SEED_EQUIPMENT: tuple[Equipment, ...] = ("microwave",)
AUTHORED_SOURCE_ID = "homechef-authored"
AUTHORED_SOURCE_VERSION = "microwave-seed-1"
AUTHORED_ARCHIVE_SHA256 = "0762d5b70ec21d043a357cc6abafd1e0f44b669bd9aeec8dbda4a91a40bf7fcc"


def authored_release_source() -> ReleaseSource:
    """Return the stable release-source record for the HomeChef seed material.

    These are HomeChef records, not a borrowed archive or external license.
    They retain the source/version/checksum/rights/attribution fields the
    protected loader maps into ``catalog_release_sources``.
    """
    return ReleaseSource(
        id=AUTHORED_SOURCE_ID,
        version=AUTHORED_SOURCE_VERSION,
        title="HomeChef-authored microwave seed catalog",
        archiveUrl="https://homechef.app/catalog/authored/microwave-seed-1",
        sha256=AUTHORED_ARCHIVE_SHA256,
        licenseName="HomeChef-authored original content",
        licenseUrl="https://homechef.app/catalog/rights",
        attribution="HomeChef-authored microwave seed catalog.",
        status="approved",
    )


class SeedIngredient(BaseModel):
    """One ingredient in a seed recipe.

    Deliberately carries no ``allergen_groups``. Allergens are a hard constraint
    and a leak is a safety incident, so the groups are derived from the shared
    vocabulary at build time rather than typed by hand into twenty files where
    one omission would be invisible.
    """

    model_config = {"extra": "forbid"}

    id: str
    measure: str


class SeedRecipe(BaseModel):
    """A hand-written recipe, before build-time enrichment.

    Fields the curator must not have to think about -- safety status, provenance,
    and image rights -- are filled in by ``to_catalog_recipe``. ``extra: forbid``
    means a typo'd key fails the build instead of being silently dropped.
    """

    model_config = {"extra": "forbid"}

    id: str
    title: str
    total_time_minutes: int = Field(gt=0, alias="totalTimeMinutes")
    cuisine: str | None = None
    ingredients: list[SeedIngredient] = Field(min_length=1)
    instructions: str

    def to_catalog_recipe(self) -> CatalogRecipe:
        return CatalogRecipe(
            id=self.id,
            title=self.title,
            imageUrl=None,
            cuisine=self.cuisine,
            totalTimeMinutes=self.total_time_minutes,
            equipmentRequired=list(SEED_EQUIPMENT),
            allergenStatus="verified",
            dietaryStatus="verified",
            dietaryTags=[],
            ingredients=[
                CatalogIngredient(
                    id=item.id,
                    rawMeasure=parse_measure(item.measure).raw,
                    quantity=parse_measure(item.measure).quantity,
                    unit=parse_measure(item.measure).unit,
                    allergenGroups=allergen_groups_for(item.id),
                )
                for item in self.ingredients
            ],
            instructions=self.instructions,
            provenance=[
                Provenance(
                    sourceId=AUTHORED_SOURCE_ID,
                    sourceVersion=AUTHORED_SOURCE_VERSION,
                    sourceRecipeId=self.id,
                    archiveSha256=AUTHORED_ARCHIVE_SHA256,
                )
            ],
        )


def load_seed_recipes(seed_dir: Path | None = None) -> list[CatalogRecipe]:
    """Load and validate every seed file.

    Raises ``pydantic.ValidationError`` on malformed content because authored
    data must be corrected before it can enter an offline release.
    """
    directory = seed_dir if seed_dir is not None else SEED_DIR
    if not directory.is_dir():
        return []

    recipes: list[CatalogRecipe] = []
    for path in sorted(directory.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        recipes.extend(SeedRecipe.model_validate(entry).to_catalog_recipe() for entry in payload)

    return recipes


def merge_seed(catalog: list[CatalogRecipe], seed: list[CatalogRecipe]) -> list[CatalogRecipe]:
    """Add authored seeds without allowing an existing HomeChef ID to change."""
    catalog_ids = {recipe.id for recipe in catalog}
    collisions = sorted(recipe.id for recipe in seed if recipe.id in catalog_ids)
    if collisions:
        raise ValueError(f"seed recipe ids collide with catalog: {', '.join(collisions)}")

    return [*catalog, *seed]
