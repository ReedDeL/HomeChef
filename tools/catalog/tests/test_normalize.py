"""The canonical vocabulary is the shared language between the vision pipeline,
the pantry, and the decision engine. An error here propagates everywhere, so
these are the tightest tests in the pipeline."""

from __future__ import annotations

import pytest

from tools.catalog.normalize import (
    allergen_groups_for,
    canonical_id,
    is_staple,
    slugify,
)


class TestCanonicalId:
    def test_collapses_scallion_synonyms_to_one_id(self) -> None:
        ids = {
            canonical_id("scallion"),
            canonical_id("Scallions"),
            canonical_id("spring onion"),
            canonical_id("Spring Onions"),
            canonical_id("green onions"),
        }
        assert ids == {"green_onion"}

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("Chicken Breast", "chicken_breast"),
            ("  chicken   breast  ", "chicken_breast"),
            ("CHICKEN BREAST", "chicken_breast"),
            ("chicken-breast", "chicken_breast"),
        ],
    )
    def test_is_insensitive_to_case_whitespace_and_punctuation(
        self, raw: str, expected: str
    ) -> None:
        assert canonical_id(raw) == expected

    def test_strips_accents(self) -> None:
        assert canonical_id("jalapeño") == "jalapeno"
        assert canonical_id("crème fraîche") == "creme_fraiche"

    def test_strips_leading_preparation_modifiers(self) -> None:
        assert canonical_id("finely chopped garlic") == "garlic"
        assert canonical_id("fresh basil") == "basil"

    def test_keeps_a_modifier_that_is_the_whole_name(self) -> None:
        # "ground" alone must not normalize away to nothing.
        assert canonical_id("ground") == "ground"

    def test_distinguishes_egg_from_eggplant(self) -> None:
        # These must stay separate ids, or allergen filtering excludes eggplant.
        assert canonical_id("egg") != canonical_id("eggplant")

    @pytest.mark.parametrize("raw", ["", "   ", "!!!", "---"])
    def test_returns_empty_for_input_carrying_no_ingredient(self, raw: str) -> None:
        assert canonical_id(raw) == ""

    def test_resolves_synonym_chains_without_looping(self) -> None:
        assert canonical_id("plain flour") == "all_purpose_flour"
        assert canonical_id("flour") == "all_purpose_flour"


class TestAllergenGroups:
    def test_butter_belongs_to_dairy(self) -> None:
        assert "dairy" in allergen_groups_for("butter")

    def test_peanut_belongs_to_nut_and_peanut(self) -> None:
        groups = allergen_groups_for("peanut")
        assert "nut" in groups
        assert "peanut" in groups

    def test_eggplant_carries_no_egg_allergen(self) -> None:
        # The whole reason allergens are groups rather than substrings.
        assert allergen_groups_for("eggplant") == []

    def test_coconut_carries_no_nut_allergen(self) -> None:
        assert allergen_groups_for("coconut") == []

    def test_unknown_ingredient_carries_no_groups(self) -> None:
        assert allergen_groups_for("dragonfruit") == []

    def test_returns_a_fresh_list_each_call(self) -> None:
        # A caller mutating the result must not corrupt the table.
        first = allergen_groups_for("butter")
        first.append("mutated")
        assert "mutated" not in allergen_groups_for("butter")


class TestStaples:
    def test_salt_is_a_staple(self) -> None:
        assert is_staple("salt") is True

    def test_saffron_is_not_a_staple(self) -> None:
        assert is_staple("saffron") is False


class TestSlugify:
    def test_collapses_runs_of_separators(self) -> None:
        assert slugify("a  --  b") == "a_b"

    def test_trims_leading_and_trailing_separators(self) -> None:
        assert slugify("--abc--") == "abc"
