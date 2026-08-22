"""Small pure transforms shared by local catalog-release tooling."""

from __future__ import annotations

from tools.catalog.models import CatalogRecipe, VocabularyEntry
from tools.catalog.normalize import allergen_groups_for, display_name, is_staple


def build_vocabulary(recipes: list[CatalogRecipe]) -> list[VocabularyEntry]:
    """Collect stable vocabulary entries from canonical recipes."""
    ids = {ingredient.id for recipe in recipes for ingredient in recipe.ingredients}
    return [
        VocabularyEntry(
            id=ingredient_id,
            displayName=display_name(ingredient_id),
            allergenGroups=allergen_groups_for(ingredient_id),
            isStaple=is_staple(ingredient_id),
        )
        for ingredient_id in sorted(ids)
    ]
