"""Hand-curated seed recipes merged into the generated catalog.

TheMealDB has two confirmed microwave-only recipes, which is not a catalog --
it is a rounding error. The microwave-only user is the wedge the product pitch
leans on, so that gap is filled by hand rather than waited out.

These live here and not in ``src/data/`` because ``python -m tools.catalog``
overwrites ``recipes.json`` wholesale on every run. Anything hand-written in the
output directory is destroyed by the next build; merging at build time is what
makes the curation durable.

See docs/superpowers/specs/2026-08-06-microwave-seed-catalog-design.md.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from tools.catalog.models import CatalogIngredient, CatalogRecipe, Equipment
from tools.catalog.normalize import allergen_groups_for

SEED_DIR = Path(__file__).resolve().parent / "seed"

# Every recipe in microwave.json is written for a microwave and nothing else.
# That is the point of the file, so it is asserted here rather than repeated
# twenty times in the JSON where one copy could drift from the rest.
SEED_EQUIPMENT: tuple[Equipment, ...] = ("microwave",)


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
            equipment_required=list(SEED_EQUIPMENT),
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

    recipes: list[CatalogRecipe] = []
    for path in sorted(directory.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        recipes.extend(SeedRecipe.model_validate(entry).to_catalog_recipe() for entry in payload)

    return recipes


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
