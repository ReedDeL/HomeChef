"""The seed catalog is hand-written, so nothing upstream validates it.

These tests are the only thing standing between a typo and a shipped recipe.
Two of them defend safety rather than correctness -- the banned-technique test
and the vocabulary test -- and both are cheap enough to be worth having.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from tools.catalog.build import build_vocabulary
from tools.catalog.models import CatalogIngredient, CatalogRecipe
from tools.catalog.seed_loader import SEED_DIR, load_seed_recipes, merge_seed

REPO_ROOT = Path(__file__).resolve().parents[3]
VOCABULARY_PATH = REPO_ROOT / "src" / "data" / "ingredients.json"

EXPECTED_SEED_COUNT = 20


@pytest.fixture(scope="module")
def seed() -> list[CatalogRecipe]:
    return load_seed_recipes()


@pytest.fixture(scope="module")
def vocabulary_ids() -> set[str]:
    entries = json.loads(VOCABULARY_PATH.read_text(encoding="utf-8"))
    return {entry["id"] for entry in entries}


class TestSeedLoads:
    def test_parses_and_validates(self, seed: list[CatalogRecipe]) -> None:
        assert len(seed) == EXPECTED_SEED_COUNT

    def test_every_recipe_is_marked_tier1(self, seed: list[CatalogRecipe]) -> None:
        # These are bundled, offline and owned, so they are Tier 1 by every part
        # of the definition. The engine needs no new case for them.
        assert all(recipe.source == "tier1" for recipe in seed)

    def test_single_meal_seed_uses_one_base_serving(self, seed: list[CatalogRecipe]) -> None:
        assert all(recipe.base_servings == 1 for recipe in seed)

    def test_ids_are_unique(self, seed: list[CatalogRecipe]) -> None:
        ids = [recipe.id for recipe in seed]
        assert len(set(ids)) == len(ids)

    def test_ids_cannot_collide_with_themealdb(self, seed: list[CatalogRecipe]) -> None:
        # TheMealDB ids are bare digits. The hc-mw- prefix makes a collision
        # impossible by construction and the provenance greppable.
        assert all(recipe.id.startswith("hc-mw-") for recipe in seed)
        assert not any(recipe.id.isdigit() for recipe in seed)

    def test_merge_rejects_an_id_collision(self, seed: list[CatalogRecipe]) -> None:
        with pytest.raises(ValueError, match="collide"):
            merge_seed(list(seed), list(seed))

    def test_merge_keeps_every_recipe(self, seed: list[CatalogRecipe]) -> None:
        generated: list[CatalogRecipe] = []
        assert len(merge_seed(generated, list(seed))) == EXPECTED_SEED_COUNT


class TestSeedContent:
    def test_every_recipe_requires_microwave(self, seed: list[CatalogRecipe]) -> None:
        # The entire reason the file exists. A seed recipe needing a stove would
        # be indistinguishable from the problem this set was written to fix.
        assert all(recipe.equipment_required == ["microwave"] for recipe in seed)

    def test_every_recipe_has_a_positive_cook_time(self, seed: list[CatalogRecipe]) -> None:
        assert all(recipe.total_time_minutes > 0 for recipe in seed)

    def test_cook_times_are_plausible_for_a_microwave(self, seed: list[CatalogRecipe]) -> None:
        # A 40-minute microwave recipe is a tagging mistake, not a slow recipe.
        assert all(recipe.total_time_minutes <= 20 for recipe in seed)

    def test_ingredient_counts_stay_small(self, seed: list[CatalogRecipe]) -> None:
        for recipe in seed:
            assert 3 <= len(recipe.ingredients) <= 6, recipe.id

    def test_no_dietary_tags_are_claimed(self, seed: list[CatalogRecipe]) -> None:
        # Absent beats wrong: dietary is a hard constraint, so an unverified tag
        # ships a violation to the user rather than merely a bad suggestion.
        assert all(recipe.dietary_tags == [] for recipe in seed)

    def test_no_image_is_claimed(self, seed: list[CatalogRecipe]) -> None:
        assert all(recipe.image_url is None for recipe in seed)

    def test_instructions_are_substantial(self, seed: list[CatalogRecipe]) -> None:
        assert all(len(recipe.instructions) > 200 for recipe in seed)


class TestSeedVocabulary:
    def test_every_ingredient_id_already_exists(
        self, seed: list[CatalogRecipe], vocabulary_ids: set[str]
    ) -> None:
        """The subtle one.

        ``build_vocabulary`` derives ingredients.json *from* the recipes, so an
        invented id is not rejected -- it is quietly accepted and becomes a
        permanent near-duplicate (``eggs`` sitting beside ``egg``) in the one
        list the vision pipeline, the pantry and the engine all share.
        """
        missing = {
            ingredient.id
            for recipe in seed
            for ingredient in recipe.ingredients
            if ingredient.id not in vocabulary_ids
        }
        assert missing == set()

    def test_allergen_groups_are_derived_not_hand_written(self, seed: list[CatalogRecipe]) -> None:
        # Every dairy ingredient in the set must carry the dairy group, or an
        # allergic user is served it. Derivation is what guarantees this; the
        # test pins the guarantee.
        for recipe in seed:
            for ingredient in recipe.ingredients:
                if ingredient.id in {"milk", "butter", "cheddar_cheese"}:
                    assert "dairy" in ingredient.allergen_groups, f"{recipe.id}/{ingredient.id}"

    def test_seed_adds_no_new_vocabulary_entries(
        self, seed: list[CatalogRecipe], vocabulary_ids: set[str]
    ) -> None:
        seed_vocabulary = {entry.id for entry in build_vocabulary(list(seed))}
        assert seed_vocabulary <= vocabulary_ids


class TestSeedSafety:
    """Microwave-specific hazards, enforced by a test rather than by care.

    Each of these is a documented way a microwave recipe injures someone. A
    reviewer will not reliably catch a re-introduction six months from now.
    """

    # Substrings checked against the full recipe text, lowercased.
    BANNED = (
        "egg in shell",
        "eggs in shell",
        "whole egg in",
        "in its shell",
        "in their shells",
        "raw chicken",
        "raw poultry",
        "raw turkey",
        "grape",
        "hot pepper",
        "chilli pepper",
        "chili pepper",
        "stuffed",
    )

    # A sentence that warns against a hazard necessarily names it. "Never
    # microwave an egg in its shell" is the most useful sentence in the recipe
    # and must not be what trips the ban list, so negated sentences are dropped
    # before scanning and only the remaining instructions are checked.
    NEGATIONS = ("never", "do not", "don't", "avoid", "rather than")

    @staticmethod
    def _instruction_sentences(text: str) -> list[str]:
        return [part for part in re.split(r"[.!?\n]+", text.lower()) if part.strip()]

    def _directive_text(self, recipe: CatalogRecipe) -> str:
        sentences = self._instruction_sentences(f"{recipe.title}. {recipe.instructions}")
        return " ".join(s for s in sentences if not any(n in s for n in self.NEGATIONS))

    def test_no_banned_technique_appears(self, seed: list[CatalogRecipe]) -> None:
        for recipe in seed:
            haystack = self._directive_text(recipe)
            for banned in self.BANNED:
                assert banned not in haystack, f"{recipe.id} instructs {banned!r}"

    def test_negation_filter_does_not_swallow_instructions(self, seed: list[CatalogRecipe]) -> None:
        """Guards the guard.

        If ``_directive_text`` ever dropped most of the text, the ban-list test
        above would pass vacuously while checking nothing.
        """
        for recipe in seed:
            kept = len(self._directive_text(recipe))
            assert kept > len(recipe.instructions) * 0.5, recipe.id

    def test_ban_list_catches_a_planted_violation(self) -> None:
        """The ban list must fail on a recipe that really does instruct a hazard."""
        planted = CatalogRecipe(
            id="hc-mw-planted",
            title="Bad Idea",
            image_url=None,
            cuisine=None,
            total_time_minutes=5,
            equipment_required=["microwave"],
            dietary_tags=[],
            ingredients=[CatalogIngredient(id="egg", measure="2")],
            instructions="Place the egg in its shell on a plate and heat for 3 minutes.",
        )
        haystack = self._directive_text(planted)
        assert any(banned in haystack for banned in self.BANNED)

    def test_no_banned_ingredient_is_used(self, seed: list[CatalogRecipe]) -> None:
        banned_ids = {"grapes", "chilli", "chili", "chicken", "turkey", "whisky", "rum", "brandy"}
        for recipe in seed:
            used = {ingredient.id for ingredient in recipe.ingredients}
            assert used.isdisjoint(banned_ids), recipe.id

    def test_egg_recipes_tell_the_user_to_beat_or_prick(self, seed: list[CatalogRecipe]) -> None:
        # An intact yolk can burst after heating, in the user's hand or mouth.
        for recipe in seed:
            if not any(item.id == "egg" for item in recipe.ingredients):
                continue
            text = recipe.instructions.lower()
            assert "beat" in text or "prick" in text, recipe.id

    def test_seed_directory_holds_only_json(self) -> None:
        unexpected = [p.name for p in SEED_DIR.iterdir() if p.suffix != ".json"]
        assert unexpected == []
