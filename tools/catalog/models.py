"""Typed boundaries for the catalog pipeline.

TheMealDB returns everything as strings, including nulls as ``""`` or ``None``
inconsistently. Parsing at the boundary means the rest of the pipeline works
with real types instead of defensively re-checking every field.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

# The closed enumeration from docs/01_TECHNICAL_SPEC.md:534. Closed is what
# makes the engine's equipment filter a set operation rather than a
# string-matching problem, so nothing may emit a value outside this list.
Equipment = Literal[
    "microwave",
    "stove",
    "oven",
    "air_fryer",
    "kettle",
    "blender",
    "rice_cooker",
    "toaster_oven",
    "none",
    # Distinct from "none". "none" is a verified claim that a recipe needs no
    # equipment; "unclassified" means tagging failed and we do not know. Writing
    # them the same way is what served stove recipes to microwave-only users.
    "unclassified",
]

EQUIPMENT_VALUES: frozenset[str] = frozenset(
    {
        "microwave",
        "stove",
        "oven",
        "air_fryer",
        "kettle",
        "blender",
        "rice_cooker",
        "toaster_oven",
        "none",
        "unclassified",
    }
)

DietaryTag = Literal[
    "vegetarian",
    "vegan",
    "gluten_free",
    "dairy_free",
    "halal",
    "kosher",
    "pescatarian",
    "keto",
]

# TheMealDB unrolls ingredients across numbered columns rather than nesting them.
MEALDB_INGREDIENT_SLOTS = 20


class MealDbMeal(BaseModel):
    """One meal exactly as TheMealDB returns it.

    Extra keys are tolerated because the API adds columns without warning; a
    missing *required* key is an error, because it means the shape changed.
    """

    model_config = {"extra": "allow", "populate_by_name": True}

    id: str = Field(alias="idMeal")
    name: str = Field(alias="strMeal")
    category: str | None = Field(default=None, alias="strCategory")
    area: str | None = Field(default=None, alias="strArea")
    instructions: str = Field(alias="strInstructions")
    image_url: str | None = Field(default=None, alias="strMealThumb")

    @field_validator("category", "area", "image_url", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        """TheMealDB uses "" and "null" where it means null."""
        if isinstance(value, str) and value.strip().lower() in {"", "null"}:
            return None
        return value


class ParsedMeasure(BaseModel):
    """A measurement split into parts, with the original always preserved."""

    quantity: float | None = None
    unit: str | None = None
    raw: str

    @property
    def is_parsed(self) -> bool:
        return self.quantity is not None


class CatalogIngredient(BaseModel):
    """One ingredient reference inside a recipe."""

    id: str
    measure: str
    allergen_groups: list[str] = Field(default_factory=list)


class CatalogRecipe(BaseModel):
    """The shape emitted to ``src/data/recipes.json``.

    Field names are camelCase because this file is consumed directly by the
    TypeScript engine, whose ``Recipe`` type this must satisfy exactly.
    """

    model_config = {"populate_by_name": True}

    id: str
    title: str
    image_url: str | None = Field(serialization_alias="imageUrl")
    cuisine: str | None
    total_time_minutes: Annotated[int, Field(gt=0)] = Field(serialization_alias="totalTimeMinutes")
    equipment_required: list[Equipment] = Field(serialization_alias="equipmentRequired")
    dietary_tags: list[DietaryTag] = Field(serialization_alias="dietaryTags")
    ingredients: list[CatalogIngredient]
    instructions: str
    source: Literal["tier1"] = "tier1"


class VocabularyEntry(BaseModel):
    """One row of ``src/data/ingredients.json`` — the canonical vocabulary.

    This list is the shared language between the vision pipeline, the pantry,
    and the decision engine, so an error here propagates everywhere.
    """

    id: str
    display_name: str = Field(serialization_alias="displayName")
    allergen_groups: list[str] = Field(default_factory=list, serialization_alias="allergenGroups")
    is_staple: bool = Field(default=False, serialization_alias="isStaple")
