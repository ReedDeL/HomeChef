"""HomeChef-authored recipes and pantry vocabulary merged into the catalog.

The authored recipe seed covers the microwave-only wedge and household staples.
The vocabulary seed preserves the broader pantry and scan language even when a
smaller attributable recipe release does not happen to use every ingredient.

These live here and not in ``src/data/`` because ``python -m tools.catalog``
overwrites ``recipes.json`` wholesale on every run. Anything hand-written in the
output directory is destroyed by the next build; merging at build time is what
makes the curation durable.

See docs/specs/2026-08-06-microwave-seed-catalog-design.md.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from tools.catalog.models import (
    CatalogIngredient,
    CatalogRecipe,
    Equipment,
    Provenance,
    VocabularyEntry,
)
from tools.catalog.normalize import allergen_groups_for
from tools.catalog.rights import ReleaseSource

SEED_DIR = Path(__file__).resolve().parent / "seed"

AUTHORED_SOURCE_ID = "homechef-authored"
AUTHORED_SOURCE_VERSION = "authored-seed-1"
AUTHORED_ARCHIVE_SHA256 = "278131540020a5fd661478316f764ad830e32b6b061eef94d61e3f2c51fd76be"


def authored_release_source() -> ReleaseSource:
    """Return the stable release-source record for the HomeChef seed material."""
    return ReleaseSource(
        id=AUTHORED_SOURCE_ID,
        version=AUTHORED_SOURCE_VERSION,
        title="HomeChef-authored recipe seed catalog",
        archiveUrl="https://raw.githubusercontent.com/ReedDeL/HomeChef/master/tools/catalog/seed/recipes.json",
        sha256=AUTHORED_ARCHIVE_SHA256,
        licenseName="HomeChef-authored original content",
        licenseUrl="https://github.com/ReedDeL/HomeChef/blob/master/docs/specs/2026-08-22-owned-recipe-catalog-design.md",
        attribution="HomeChef-authored recipe seed catalog.",
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

    Fields the curator must not have to think about -- ``source``, ``imageUrl``,
    ``dietaryTags`` -- are filled in by ``to_catalog_recipe``. ``extra: forbid``
    means a typo'd key fails the build instead of being silently dropped.
    """

    model_config = {"extra": "forbid"}

    id: str
    title: str
    total_time_minutes: int = Field(gt=0, alias="totalTimeMinutes")
    cuisine: str | None = None
    equipment_required: list[Equipment] = Field(min_length=1, alias="equipmentRequired")
    ingredients: list[SeedIngredient] = Field(min_length=1)
    instructions: str

    def to_catalog_recipe(self) -> CatalogRecipe:
        return CatalogRecipe(
            id=self.id,
            title=self.title,
            # No image. A wrong or placeholder photo is worse than none, and we
            # have no rights-cleared photography for hand-written recipes.
            image_url=None,
            cuisine=self.cuisine,
            total_time_minutes=self.total_time_minutes,
            equipment_required=self.equipment_required,
            # Left empty for the same reason the TheMealDB path leaves it empty:
            # dietary is a hard constraint, so a false "vegan" ships a violation.
            dietary_tags=[],
            ingredients=[
                CatalogIngredient(
                    id=item.id,
                    measure=item.measure,
                    allergen_groups=allergen_groups_for(item.id),
                )
                for item in self.ingredients
            ],
            instructions=self.instructions,
            provenance=[
                Provenance(
                    source_id=AUTHORED_SOURCE_ID,
                    source_version=AUTHORED_SOURCE_VERSION,
                    source_recipe_id=self.id,
                    archive_sha256=AUTHORED_ARCHIVE_SHA256,
                )
            ],
            # Each curated entry describes one complete single-meal preparation.
            base_servings=1,
        )


def load_seed_recipes(seed_dir: Path | None = None) -> list[CatalogRecipe]:
    """Load and validate every seed file.

    Raises ``pydantic.ValidationError`` on malformed content. Unlike the
    TheMealDB path, which skips a bad record so one API hiccup cannot fail a
    300-recipe build, a broken seed file is our own mistake and should stop the
    build loudly.
    """
    directory = seed_dir if seed_dir is not None else SEED_DIR
    if not directory.is_dir():
        return []

    path = directory / "recipes.json"
    if not path.is_file():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [SeedRecipe.model_validate(entry).to_catalog_recipe() for entry in payload]


def load_seed_vocabulary(seed_dir: Path | None = None) -> list[VocabularyEntry]:
    """Load the deterministic pantry and scan vocabulary seed."""
    directory = seed_dir if seed_dir is not None else SEED_DIR
    path = directory / "vocabulary.json"
    if not path.is_file():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [VocabularyEntry.model_validate(entry) for entry in payload]


def merge_seed(generated: list[CatalogRecipe], seed: list[CatalogRecipe]) -> list[CatalogRecipe]:
    """Combine generated and seed recipes, seed last.

    An id collision means a hand-written recipe would silently replace a fetched
    one or vice versa, and which won would depend on ordering. Neither is
    acceptable in a catalog whose ids are stable references, so it raises.
    """
    generated_ids = {recipe.id for recipe in generated}
    collisions = sorted(recipe.id for recipe in seed if recipe.id in generated_ids)
    if collisions:
        raise ValueError(f"seed recipe ids collide with generated ids: {', '.join(collisions)}")

    return [*generated, *seed]
