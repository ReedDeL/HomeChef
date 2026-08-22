"""Strict source-neutral models for the HomeChef catalog pipeline."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

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
SafetyStatus = Literal["verified", "unknown"]


class ParsedMeasure(BaseModel):
    """A source measure retains display text even when structured parsing fails."""

    quantity: float | None = None
    unit: str | None = None
    raw: str

    @property
    def is_parsed(self) -> bool:
        return self.quantity is not None


class SourceIngredient(BaseModel):
    """One source archive ingredient; extra keys are a contract violation."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    name: str
    measure: str = ""

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("ingredient name must not be blank")
        return value.strip()


class SourceRecipe(BaseModel):
    """The single neutral JSONL record format accepted by this pipeline."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    source_recipe_id: str = Field(alias="sourceRecipeId")
    title: str
    instructions: str
    ingredients: list[SourceIngredient]
    cuisine: str | None = None
    total_time_minutes: Annotated[int, Field(gt=0)] = Field(alias="totalTimeMinutes")
    image_url: str | None = Field(default=None, alias="imageUrl")
    equipment: list[Equipment]
    allergen_status: SafetyStatus = Field(alias="allergenStatus")
    dietary_status: SafetyStatus = Field(alias="dietaryStatus")
    dietary_tags: list[DietaryTag] = Field(default_factory=list, alias="dietaryTags")

    @field_validator("source_recipe_id", "title", "instructions")
    @classmethod
    def require_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value.strip()

    @field_validator("cuisine", "image_url", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class CatalogIngredient(BaseModel):
    """Normalized ingredient with raw and parsed measure forms."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    id: str
    raw_measure: str = Field(alias="rawMeasure", serialization_alias="rawMeasure")
    quantity: float | None = None
    unit: str | None = None
    allergen_groups: list[str] = Field(
        default_factory=list, alias="allergenGroups", serialization_alias="allergenGroups"
    )

    @property
    def measure(self) -> str:
        """Compatibility accessor for handwritten seed validation."""
        return self.raw_measure


class Provenance(BaseModel):
    """A source row retained after recipes from different archives coalesce."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    source_id: str = Field(alias="sourceId", serialization_alias="sourceId")
    source_version: str = Field(alias="sourceVersion", serialization_alias="sourceVersion")
    source_recipe_id: str = Field(alias="sourceRecipeId", serialization_alias="sourceRecipeId")
    archive_sha256: str = Field(alias="archiveSha256", serialization_alias="archiveSha256")


class CatalogRecipe(BaseModel):
    """Canonical HomeChef recipe emitted in a candidate release."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    id: str
    title: str
    image_url: str | None = Field(alias="imageUrl", serialization_alias="imageUrl")
    cuisine: str | None
    total_time_minutes: Annotated[int, Field(gt=0)] = Field(
        alias="totalTimeMinutes", serialization_alias="totalTimeMinutes"
    )
    equipment_required: list[Equipment] = Field(
        alias="equipmentRequired", serialization_alias="equipmentRequired"
    )
    allergen_status: SafetyStatus = Field(
        alias="allergenStatus", serialization_alias="allergenStatus"
    )
    dietary_status: SafetyStatus = Field(alias="dietaryStatus", serialization_alias="dietaryStatus")
    dietary_tags: list[DietaryTag] = Field(alias="dietaryTags", serialization_alias="dietaryTags")
    ingredients: list[CatalogIngredient]
    instructions: str
    provenance: list[Provenance]


class VocabularyEntry(BaseModel):
    """A stable ingredient vocabulary entry built from canonical recipes."""

    model_config = {"extra": "forbid", "populate_by_name": True}

    id: str
    display_name: str = Field(alias="displayName", serialization_alias="displayName")
    allergen_groups: list[str] = Field(
        default_factory=list, alias="allergenGroups", serialization_alias="allergenGroups"
    )
    is_staple: bool = Field(default=False, alias="isStaple", serialization_alias="isStaple")
