"""Equipment tagging is the product wedge. The invariant these tests defend is
that the emitted value is ALWAYS inside the closed enum -- that is what makes
the TypeScript engine's filter a set operation instead of string matching."""

from __future__ import annotations

import pytest

from tools.catalog.equipment import coerce_equipment, tag_from_text
from tools.catalog.models import EQUIPMENT_VALUES


class TestCoerceEquipment:
    def test_passes_through_valid_values(self) -> None:
        assert coerce_equipment(["microwave", "oven"]) == ["microwave", "oven"]

    def test_normalises_spacing_case_and_hyphens(self) -> None:
        assert coerce_equipment(["Air Fryer", "RICE-COOKER"]) == ["air_fryer", "rice_cooker"]

    def test_drops_a_hallucinated_appliance(self) -> None:
        # The guard against LLM output inventing a value the engine cannot read.
        assert coerce_equipment(["sous_vide", "microwave"]) == ["microwave"]

    def test_falls_back_to_unclassified_when_nothing_is_recognised(self) -> None:
        # NOT ["none"]. "none" is a claim that the recipe needs no equipment and
        # the engine treats it as always satisfied, so using it here would serve
        # an unclassified stove recipe to a microwave-only user as verified.
        assert coerce_equipment(["sous_vide", "thermomix"]) == ["unclassified"]

    def test_preserves_an_explicit_none(self) -> None:
        # The caller asserted it; we are not filling a gap on their behalf.
        assert coerce_equipment(["none"]) == ["none"]

    def test_prefers_a_real_appliance_over_none(self) -> None:
        assert coerce_equipment(["none", "microwave"]) == ["microwave"]

    def test_prefers_a_real_appliance_over_unclassified(self) -> None:
        assert coerce_equipment(["unclassified", "microwave"]) == ["microwave"]

    def test_deduplicates(self) -> None:
        assert coerce_equipment(["oven", "oven", "oven"]) == ["oven"]

    @pytest.mark.parametrize("value", [None, "microwave", 42, {"a": 1}, []])
    def test_never_raises_on_non_list_input(self, value: object) -> None:
        assert coerce_equipment(value) == ["unclassified"]

    def test_ignores_non_string_members(self) -> None:
        assert coerce_equipment([42, None, "oven"]) == ["oven"]

    @pytest.mark.parametrize(
        "raw",
        [["oven"], ["sous_vide"], [], ["none"], "not a list", None, [1, 2, 3]],
    )
    def test_output_is_always_inside_the_closed_enum(self, raw: object) -> None:
        result = coerce_equipment(raw)
        assert result, "must never be empty"
        assert set(result) <= EQUIPMENT_VALUES


class TestTagFromText:
    def test_detects_a_microwave_recipe(self) -> None:
        assert tag_from_text("Microwave on high for 2 minutes.") == ["microwave"]

    def test_prefers_toaster_oven_over_oven(self) -> None:
        assert "toaster_oven" in tag_from_text("Cook in a toaster oven for 10 minutes.")

    def test_detects_baking_as_oven(self) -> None:
        assert "oven" in tag_from_text("Bake at 180C for 25 minutes.")

    def test_detects_simmering_as_stove(self) -> None:
        assert "stove" in tag_from_text("Simmer gently in a saucepan.")

    def test_returns_unclassified_when_no_keyword_matches(self) -> None:
        # This text really is no-cook, but the keyword pass cannot know that --
        # it only knows it recognised nothing. "unclassified" is the honest
        # answer; only a verified pass may promote a recipe to "none".
        assert tag_from_text("Combine everything in a bowl and serve.") == ["unclassified"]

    def test_handles_empty_and_missing_text(self) -> None:
        assert tag_from_text("") == ["unclassified"]
        assert tag_from_text(None) == ["unclassified"]
        assert tag_from_text(None, None) == ["unclassified"]

    def test_output_is_always_inside_the_closed_enum(self) -> None:
        assert set(tag_from_text("bake fry blend microwave boil")) <= EQUIPMENT_VALUES
