"""Allergen coverage. An allergen leak is a safety incident, not a bug report.

The engine's matching is correct and never relaxed (src/engine/filter-hard.ts),
so the only way a declared allergen reaches a user is an untagged ingredient.
These tests guard both directions: real allergens must carry their group, and
lookalike names must not, because a keyword pass over this vocabulary tags
``nutmeg`` as a nut and ``eggplant`` as egg."""

from __future__ import annotations

import pytest

from tools.catalog.normalize import allergen_groups_for

# Variants that shipped untagged and were served to users who declared the
# matching allergy. Each is a real id in src/data/ingredients.json.
TAGGED: list[tuple[str, str]] = [
    ("mozzarella", "dairy"),
    ("sour_cream", "dairy"),
    ("greek_yogurt", "dairy"),
    ("unsalted_butter", "dairy"),
    ("buttermilk", "dairy"),
    ("cream_cheese", "dairy"),
    ("ghee", "dairy"),
    ("egg_yolks", "egg"),
    ("mayonnaise", "egg"),
    ("egg_wash", "egg"),
    ("breadcrumbs", "gluten"),
    ("self_raising_flour", "wheat"),
    ("puff_pastry", "gluten"),
    ("macaroni", "gluten"),
    ("couscous", "gluten"),
    ("cod", "fish"),
    ("smoked_haddock", "fish"),
    ("fish_stock", "fish"),
    ("king_prawns", "shellfish"),
    ("mussels", "shellfish"),
    ("oyster_sauce", "shellfish"),
    ("pine_nuts", "tree_nut"),
    ("peanut_oil", "peanut"),
]

# Names a substring or keyword pass gets wrong. Tagging any of these hides
# large parts of the catalog from users who have no such allergy.
NOT_TAGGED: list[tuple[str, str]] = [
    ("nutmeg", "nut"),
    ("butternut_squash", "nut"),
    ("butternut_squash", "dairy"),
    ("butter_beans", "dairy"),
    ("coconut_milk", "dairy"),
    ("coconut_cream", "dairy"),
    ("eggplant", "egg"),
    ("egg_plants", "egg"),
    ("oyster_mushrooms", "shellfish"),
    ("chestnut_mushroom", "tree_nut"),
    ("water_chestnut", "tree_nut"),
    ("corn_flour", "gluten"),
    ("rice_flour", "gluten"),
    ("rice_noodles", "gluten"),
    ("breadfruit", "gluten"),
    ("floury_potatoes", "gluten"),
]


@pytest.mark.parametrize(("ingredient_id", "group"), TAGGED)
def test_allergen_variant_carries_group(ingredient_id: str, group: str) -> None:
    assert group in allergen_groups_for(ingredient_id)


@pytest.mark.parametrize(("ingredient_id", "group"), NOT_TAGGED)
def test_lookalike_does_not_carry_group(ingredient_id: str, group: str) -> None:
    assert group not in allergen_groups_for(ingredient_id)


def test_rye_is_gluten_but_not_wheat() -> None:
    """A wheat-only allergy must not be widened into every gluten grain."""
    groups = allergen_groups_for("rye_bread")
    assert "gluten" in groups
    assert "wheat" not in groups


def test_egg_noodles_carry_both_sources() -> None:
    groups = allergen_groups_for("egg_noodles")
    assert {"egg", "gluten"} <= set(groups)


def test_unknown_ingredient_carries_no_groups() -> None:
    assert allergen_groups_for("not_a_real_ingredient") == []
